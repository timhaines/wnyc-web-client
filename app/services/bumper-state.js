import Ember from 'ember';
import service from 'ember-service/inject';
import computed, { readOnly, not } from 'ember-computed';
import get, { getProperties } from 'ember-metal/get';
import ENV from 'overhaul/config/environment';
import { inExperimentalGroup } from 'overhaul/helpers/in-experimental-group';

export default Ember.Service.extend({
  init() {
    this._super(...arguments);
    get(this, 'store').findAll('stream');
  },
  queue: service('listen-queue'),
  session: service(),
  store: service(),
  audio: service(),
  features: service(),
  autoplayPref: readOnly('session.data.user-prefs-active-autoplay'),
  autoplaySlug: readOnly('session.data.user-prefs-active-stream.slug'),
  durationLoaded: computed.gt('audio.duration', 0),
  audioLoaded: not('audio.isLoading'),
  bumperLoaded: computed.and('durationLoaded', 'audioLoaded'),
  bumperPlaying: computed.and('bumperLoaded', 'bumperStarted'),
  bumperDidPlay: false,
  bumperStarted: false,
  revealNotificationBar: computed('bumperPlaying', 'bumperDidPlay', function() {
    // Google Experiment Continuous Play - START
    if (!( this.get('features').isEnabled('autoplay-prefs') && inExperimentalGroup([1]) )) {
      return false;
    }
    // Google Experiment Continuous Play - END

    return this.get('bumperPlaying') || this.get('bumperDidPlay');
  }),
  isEnabled: computed('autoplayPref', 'queue.items.length', function() {
    // Google Experiment Continuous Play - START
    if (!(this.get('features').isEnabled('autoplay-prefs') && inExperimentalGroup([1]) )){
      return false;
    }
    // Google Experiment Continuous Play - END

    const { autoplayPref, queue } = getProperties(this, 'autoplayPref', 'queue');
    const items = get(queue, 'items') || [];
    // if there is nothing left in the queue, then it is redundant/unecessary to
    // play the bumper file. The `play` function will still be called on the audio,
    // but will not play anything, anyway, because it won't recognize the `id`
    // parameter
    if (autoplayPref === 'queue' && items.length === 0) {
      return false;
    } else {
      return autoplayPref !== 'no_autoplay';
    }
  }),

  getNext(prevContext) {
    // determine which stage the continuous-play is in
    const autoplaySlug = get(this, 'autoplaySlug') || 'wnyc-fm939';
    const autoplayPref = get(this, 'autoplayPref') || 'default_stream';

    if (prevContext === 'continuous-play-bumper') {
      // the bumper had played, so setup the default content from the user settings
      return this.setupContent(autoplayPref, autoplaySlug);
    } else {
      // the active selection the user was listening to use has ended, so now
      // the bumper gets setup.
      return this.setupBumper(autoplayPref, autoplaySlug);
    }
  },

  setupContent(autoplayPref, autoplaySlug) {
    this.set('bumperDidPlay', true);
    if (autoplayPref === 'default_stream') {
      return [autoplaySlug, 'stream'];
    } else {
      const queue = get(this, 'queue');
      const nextUp = queue.nextItem();
      return [get(nextUp, 'id'), 'queue'];
    }
  },

  setupBumper(autoplayPref, autoplaySlug) {
    this.set('bumperStarted', true);
    let nextItem;
    if (autoplayPref === 'default_stream') {
      let stream = get(this, 'store').peekRecord('stream', autoplaySlug);
      if (stream) {
        nextItem = get(stream, 'audioBumper');
      } else {
        nextItem = ENV.queueAudioBumperURL;
      }
    } else {
      nextItem = ENV.queueAudioBumperURL;
    }

    return [nextItem, 'continuous-play-bumper'];
  }
});
