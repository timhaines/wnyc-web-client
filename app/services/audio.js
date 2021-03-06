import Service from 'ember-service';
import service from 'ember-service/inject';
import get from 'ember-metal/get';
import set from 'ember-metal/set';
import computed, { readOnly, alias, or } from 'ember-computed';
import { bind } from 'ember-runloop';
import RSVP from 'rsvp';
import { classify as upperCamelize } from 'ember-string';
import Ember from 'ember';

const FIFTEEN_SECONDS = 1000 * 15;
const TWO_MINUTES     = 1000 * 60 * 2;

export default Service.extend({
  poll:             service(),
  metrics:          service(),
  store:            service(),
  session:          service(),
  discoverQueue:    service(),
  bumperState:      service(),
  listens:          service('listen-history'),
  queue:            service('listen-queue'),
  dataPipeline:      service(),

  hifi:             service(),
  isReady:          readOnly('hifi.isReady'),
  isPlaying:        readOnly('hifi.isPlaying'),
  isLoading:        readOnly('hifi.isLoading'),
  isMuted:          readOnly('hifi.isMuted'),
  duration:         readOnly('hifi.duration'),
  percentLoaded:    readOnly('hifi.percentLoaded'),
  position:         alias('hifi.position'),
  volume:           alias('hifi.volume'),

  // TODO: fix up currentStory/currentAudio interfaces for streams and on demands
  currentStory:         or('currentAudio.story', 'currentAudio'),

  currentAudio:     null,
  currentContext:   null,
  sessionPing:      TWO_MINUTES,

  currentId: computed('currentAudio.id', {
    get() {
      return get(this, 'currentAudio.id');
    },
    set(k, v) { return v; }
  }),

  playState: computed('isPlaying', 'isLoading', function() {
    if (get(this, 'isLoading')) {
      return 'is-loading';
    } else if (get(this, 'isPlaying')) {
      return 'is-playing';
    } else {
      return 'is-paused';
    }
  }),

  /* TRACK LOGIC --------------------------------------------------------------*/

  init() {
    this.get('hifi').on('audio-ended', () => this.finishedTrack());
    Ember.$(window).on('beforeunload', () => {
      if (this.get('currentAudio')) {
        this.sendListenAction(this.get('currentAudio'), 'close');
      }
    });
    this._super(...arguments);
  },
  
  willDestroy() {
    Ember.$(window).off('beforeunload');
  },

  play(pk, playContext) {
    // TODO: might be better to switch the arg order for better api design
    // i.e. there will always be a context, but there might not always be a pk
    let id = pk || get(this, 'currentId');
    let context = playContext || '';

    if (!id) {
      return;
    }

    if (this._audioType(id) === 'on_demand') {
      return this.playFromPk(id, context);
    } else if (this._audioType(id) === 'bumper') {
      return this.playBumper(id, context);
    } else { //stream
      return this.playStream(id, context);
    }
  },

  pause() {
    let context = get(this, 'currentContext') || '';
    let storyOrStream = get(this, 'currentAudio');
    this._trackPause(storyOrStream, context);
    this.get('hifi').pause();
  },

  playFromPk(id, context) {
    this._firstTimePlay();

    let prevContext = get(this, 'currentContext');
    let newStoryPlaying = get(this, 'currentId') !== id;
    
    if (newStoryPlaying && this.get('isPlaying')) {
      this.sendListenAction(this.get('currentAudio'), 'interrupt');
    }

    // set here so UI can update before play resolves
    set(this, 'currentId', id);

    let story;
    let urlPromise = get(this, 'store').findRecord('story', id).then(s => {
      story = s;
      // resetSegments & getCurrentSegment return the audio value if the
      // audio is not segmented
      return newStoryPlaying ? s.resetSegments() : s.getCurrentSegment();
    });

    return this.get('hifi').play(urlPromise).then(({sound, failures}) => {
      if (newStoryPlaying) {
        this._trackOnDemandPlay(story, context);
      } else {
        this.sendListenAction(story, 'resume');
      }

      // independent of context, if this item is already the first item in your
      // listening history, don't bother adding it again
      if (get(this, 'listens').indexByStoryPk(id) !== 0) {
        this.addToHistory(story);
      }

      // TODO: isCurrentSegment relies on `currentAudio` to compare incoming sound
      // so this needs to run before _setupAudio otherwise currentAudio and sound
      // will always match.
      let restartingSegment = this._isCurrentSegment(sound) && newStoryPlaying;
      this._setupAudio(story, context);

      if (this._didJustPlayFrom('queue')) {
        this.removeFromQueue(id);
      }

      // replay current audio from start when:
      // * starting it from the queue (while already playing from elsewhere)
      // * clicking a play button from earlier history (while already playing that story)
      // * clicking a segment (while playing the same segment from an episode)
      let restartingFromQueue = this._didJustPlayFrom('queue') && prevContext !== 'queue' && !newStoryPlaying;
      let restartingFromHistory = this._didJustPlayFrom('history') && get(this, 'isPlaying') && !newStoryPlaying;

      if (restartingFromQueue || restartingFromHistory || restartingSegment) {
        this.setPosition(0);
      }

      this._trackAllCodecFailures(failures, sound);
      return {sound, failures};
    })
    .catch(e => this._trackSoundFailure(e));
  },

  playStream(slug, context = '') {
    this._firstTimePlay();
    let newStreamPlaying = get(this, 'currentId') !== slug;
    
    if (newStreamPlaying && this.get('isPlaying')) {
      this.sendListenAction(this.get('currentAudio'), 'interrupt');
    }

    // set here so UI can update before play resolves
    set(this, 'currentId', slug);

    let stream;
    let urlPromise = get(this, 'store').findRecord('stream', slug).then(s => {
      stream = s;
      return s.get('urls');
    });

    return this.get('hifi').play(urlPromise).then(({sound, failures}) => {
      if (newStreamPlaying) {
        let prevAudio = get(this, 'currentAudio');
        this._trackStreamPlay(stream, context, prevAudio);
      } else {
        this.sendListenAction(stream, 'resume');
      }

      this._setupAudio(stream, context);
      this._trackAllCodecFailures(failures, sound);
      return {sound, failures};
    })
    .catch(e => this._trackSoundFailure(e));
  },

  playBumper() {
    let bumperState = get(this, 'bumperState');
    let url = bumperState.getBumperUrl();

    set(bumperState, 'bumperStarted', true);

    let context = 'Continuous Play';
    let bumper = Ember.Object.create({
      audioType: 'bumper',
      id: url
    });

    return get(this, 'hifi').play(url).then(({sound, failures}) => {
      this._trackBumperPlay();
      this._setupAudio(bumper, context);
      this._trackAllCodecFailures(failures, sound);
      return {sound, failures};
    })
    .catch(e => this._trackSoundFailure(e));
  },

  playAutoplay() {
    let bumperState = get(this, 'bumperState');
    let next = bumperState.getAutoplayAudioId();

    set(bumperState, 'bumperDidPlay', true);

    if (this._audioType(next) === 'on_demand') {
      this._trackAutoplayQueue();
      return this.play(next, 'queue');
    } else { //stream
      return this.play(next, 'Continuous Play');
    }
  },

  playNextSegment() {
    let story = get(this, 'currentAudio');
    let nextSegment = story.getNextSegment();
    if (nextSegment) {
      return this.get('hifi').play(nextSegment, {position: 0})
      .then(({sound, failures}) => {
        this._trackAllCodecFailures(failures, sound);
        return {sound, failures};
      })
      .catch(e => this._trackSoundFailure(e));
    } else {
      return false;
    }
  },

  setPosition(percentage) {
    // send listenAction before setting position so we capture the timestamp where
    // the action itself occurs
    this.sendListenAction(this.get('currentAudio'), 'position');
    
    let position = (percentage * get(this, 'duration')) || 0;
    set(this, 'position', position);
  },

  rewind() {
    // send listenAction before setting position so we capture the timestamp where
    // the action itself occurs
    this.sendListenAction(this.get('currentAudio'), 'back_15');
    
    let currentPosition = get(this, 'position');
    set(this, 'position', currentPosition - FIFTEEN_SECONDS);

    this._trackPlayerEvent({
      action: 'Skip Fifteen Seconds Back',
      withAnalytics: true
    });
  },

  fastForward() {
    // send listenAction before setting position so we capture the timestamp where
    // the action itself occurs
    this.sendListenAction(this.get('currentAudio'), 'forward_15');
    
    let currentPosition = get(this, 'position');
    set(this, 'position', currentPosition + FIFTEEN_SECONDS);

    this._trackPlayerEvent({
      action: 'Skip Fifteen Seconds Ahead',
      withAnalytics: true
    });
  },

  toggleMute() {
    get(this, 'hifi').toggleMute();
  },


  /* QUEUEING LOGIC -----------------------------------------------------------*/

  addToQueue(id, region) {
    get(this, 'queue').addToQueueById(id)
    .then(story => {
      this._trackPlayerEvent({
        action: 'Add Story to Queue',
        withRegion: true,
        region,
        withAnalytics: true,
        story
      });
    });
  },

  removeFromQueue(id) {
    get(this, 'queue').removeFromQueueById(id);
  },

  resetQueue(newQueue) {
    get(this, 'queue').reset(newQueue);
  },

  queueHasNext() {
    return get(this, 'queue').nextItem();
  },

  playNextInQueue() {
    let queue = get(this, 'queue');
    let nextUp = queue.nextItem();

    if (nextUp) {
      this.play(nextUp.get('id'), 'queue');
      return true;
    } else {
      return this._flushContext();
    }
  },

  /* DISCOVER QUEUE -----------------------------------------------------------*/

  discoverHasNext() {
    return this.get('discoverQueue').nextItem(this.get('currentId'));
  },

  playDiscoverQueue() {
    let nextTrack = this.get('discoverQueue').nextItem(this.get('currentId'));
    if (nextTrack) {
      this.play(get(nextTrack, 'id'), 'discover');
      return true;
    } else {
      return this._flushContext();
    }
  },

  /* EVENTS -------------------------------------------------------*/

  finishedTrack() {
    let currentAudio = get(this, 'currentAudio');
    let currentContext = get(this, 'currentContext');
    let autoPlayEnabled = get(this, 'bumperState.autoplayEnabled');

    if (get(currentAudio, 'segmentedAudio') && currentAudio.hasNextSegment()) {
      return this.playNextSegment();
    }
    else if (this._didJustPlayFrom('queue') && this.queueHasNext()) {
      this._trackFinished(currentAudio, currentContext);
      return this.playNextInQueue();
    }
    else if (this._didJustPlayFrom('discover') && this.discoverHasNext()) {
      this._trackFinished(currentAudio, currentContext);
      return this.playDiscoverQueue();
    }
    else if (autoPlayEnabled && !this._didJustPlayFrom('Continuous Play')) {
      this._trackFinished(currentAudio, currentContext);
      return this.playBumper();
    }
    else if (this._didJustPlayFrom('Continuous Play')) {
      return this.playAutoplay();
    } else {
      this._trackFinished(currentAudio, currentContext);
    }
    return null;
  },

  /* ANALYTICS AND LISTEN ACTIONS -------------------------------------------------------*/
  addToHistory(story) {
    this.get('listens').addListen(story);
  },
  
  sendListenAction(storyOrStream, type) {
    let data = {
      current_audio_position: this.get('position')
    };
    storyOrStream.forListenAction(data).then(d => {
      this.get('dataPipeline').reportListenAction(type, d);
    });
  },
  
  _trackPlayerEvent(options) {
    let metrics        = get(this, 'metrics');
    let {action, label, withRegion, region, withAnalytics} = options;
    let analyticsCode  = '';
    let story          = options.story || get(this, 'currentAudio');
    let category       = options.category || 'Persistent Player';

    // Ignore event if it's missing a region but should have one.
    // Assume it was fired from player internals and shouldn't be logged.
    if (withRegion && !region) { return; }
    region = withRegion ? region + ':' : '';
    if (withAnalytics) {
      analyticsCode = get(story, 'analyticsCode');
    }
    if (withRegion || withAnalytics) {
      label = `${region}${analyticsCode}`;
    }
    metrics.trackEvent('GoogleAnalytics', {category, action, label});
  },

  _trackPlayerEventForNpr(options) {
    let metrics = get(this, 'metrics');
    metrics.trackEvent('NprAnalytics', options);
  },

  _trackAllCodecFailures(failures, sound) {
    if (failures && failures.length) {
      failures.forEach(failed => this._trackCodecFailure(failed, sound));
    }
  },

  _trackCodecFailure({connectionName, error, url}, sound) {
    this._trackPlayerEvent({
      action: `Codec Failure | ${connectionName}`,
      label: `reason: ${error} | bad url: ${url} | ${sound ? `good url: ${get(sound, 'url')}` : 'no successful url'}`
    });
  },

  _trackSoundFailure({message, failures}) {
    this.set('hasErrors', true);
    this._trackPlayerEvent({
      action: 'Sound Error',
      label: message
    });
    if (failures && failures.length) {
      failures.forEach(failed => this._trackCodecFailure(failed));
    }
  },

  _trackPing() {
    get(this, 'metrics').trackEvent('GoogleAnalytics', {
      category: 'Persistent Player',
      action: '2 Minute Ping',
      value: get(this, 'isPlaying') ? 1 : 0
    });
  },

  _trackOnDemandPlay(story, context) {
    let action = this.get('position') === 0 ? 'start' : 'resume';
    this.sendListenAction(story, action);
    this._trackPlayerEvent({
      action: `Played Story "${story.get('title')}"`,
      withRegion: true,
      region: upperCamelize(context),
      withAnalytics: true,
      story
    });
    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'On_demand_audio_play',
      label: get(story, 'audio')
    });

    if (context === 'queue' || context === 'history') {
      this._trackPlayerEvent({
        action: 'Played Story from Queue',
        label: story.get('title'),
        story
      });
    }
  },

  _trackStreamPlay(stream, context, prevAudio) {
    let wasStream = prevAudio && get(prevAudio, 'audioType') === 'livestream';
    let prevStreamName = prevAudio && get(prevAudio, 'name');
    let streamName = get(stream, 'name');

    let label = streamName;
    if (context === 'nav' || context === 'Continuous Play') {
      label += `|${this._formatContext(context)}`;
    }
    this._trackPlayerEvent({
      action: 'Launched Stream',
      label,
    });
    this.sendListenAction(stream, 'start');

    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'Stream_Play',
      label: `Streaming_${streamName}`
    });

    if (wasStream) {
      this._trackPlayerEvent({
        action: 'Switched Stream to Stream',
        label: `from ${prevStreamName} to ${streamName}`
      });

      this._trackPlayerEventForNpr({
        category: 'Engagement',
        action: 'Stream_Change',
        label: `Streaming_${streamName}`
      });
    }
  },

  _trackBumperPlay() {
    this._trackPlayerEvent({
      action: 'Continuous Play Notification',
      label: 'Audio Bumper',
    });
  },
  
  _trackAutoplayQueue() {
    this._trackPlayerEvent({
      action: 'Launched Queue',
      label: 'Continuous Play'
    });
  },

  _trackPause(storyOrStream, context) {
    let type = storyOrStream && get(storyOrStream, 'audioType');
    if (type === 'bumper') {
      let bumperSetting = get(this, 'bumperState.autoplayChoice');
      this._trackPlayerEvent({
        action: 'Paused Bumper',
        label: `${bumperSetting}|Continuous Play`
      });
    } else {
      this._trackPlayerEvent({
        story: storyOrStream,
        action: 'Pause',
        withRegion: true,
        region: this._formatContext(context),
      });
    }

    if (type === 'livestream') {
      this._trackPlayerEventForNpr({
        category: 'Engagement',
        action: 'Stream_Pause',
        label: `Streaming_${get(storyOrStream, 'name')}`
      });
    } else if (type === 'on_demand') {
      this._trackPlayerEventForNpr({
        category: 'Engagement',
        action: 'On_demand_audio_pause',
        label: get(storyOrStream, 'audio')
      });
    }

    if (storyOrStream) {
      this.sendListenAction(storyOrStream, 'pause');
    }
  },

  _trackFinished(story, context) {
    this._trackPlayerEvent({
      story,
      action: 'Finished Story',
      withRegion: true,
      region: upperCamelize(context),
    });

    this.sendListenAction(story, 'finish');
  },
  
  // TODO: would like to move this and the rest of the above
  // into an audio analytics service
  trackStreamData() {
    let stream = this.get('currentAudio');
    let showTitle = get(stream, 'currentShow.show_title') || get(stream, 'currentShow.title');
    let streamName = get(stream, 'name');
    
    RSVP.Promise.resolve(get(stream, 'story')).then(story => {
      let storyTitle = story ? get(story, 'title') : 'no title';
      
      this._trackPlayerEvent({
        action: `Streamed Show "${showTitle}" on ${streamName}`,
        label: storyTitle
      });
      
      if (story) {
        this._trackPlayerEvent({
          action: `Streamed Story "${storyTitle}" on "${streamName}"`,
          withAnalytics: true,
          story
        });
      }
    });
  },

  /* HELPERS -------------------------------------------------------*/

  _isCurrentSegment(sound) {
    let prevStory = get(this, 'currentAudio');
    if (!prevStory) {
      return false;
    }
    let isOnDemand = prevStory.get('audioType') !== 'livestream';
    let isSegmented = get(prevStory, 'segmentedAudio');
    // put `getCurrentSegment` behind the and gates b/c sometimes prevStory is a stream model, which doesn't have `getCurrentSegment`
    if (isOnDemand && isSegmented && prevStory.getCurrentSegment() === sound.get('url')) {
      return true;
    } else {
      return false;
    }
  },

  _didJustPlayFrom(context) {
    return context === get(this, 'currentContext');
  },

  _flushContext() {
    set(this, 'currentContext', null);
  },

  _firstTimePlay() {
    if (get(this, 'playedOnce')) {
      // already setup
      return;
    }

    set(this, 'playedOnce', true); // opens the player
    get(this, 'poll').addPoll({
      interval: get(this, 'sessionPing'),
      callback: bind(this, this._trackPing),
      label: 'playerPing'
    });
  },

  _setupAudio(audio, context) {
    // use when we played a new piece of audio.
    // clear errors, set currentAudio and currentContext.
    set(this, 'hasErrors', false);
    set(this, 'currentAudio', audio);
    set(this, 'currentContext', context);
  },

  _audioType(id) {
    if (/^\d*$/.test(id)) {
      return 'on_demand';
    } else if (/^http|^https/.test(id)) {
      return 'bumper';
    } else {
      return 'livestream';
    }
  },

  _formatContext(context) {
    if (context === 'Continuous Play') {
      return context;
    } else if (context === 'nav') {
      return 'Navigation';
    } else {
      return upperCamelize(context);
    }
  },
});
