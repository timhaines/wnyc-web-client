import Ember from 'ember';

export default Ember.Component.extend({
  classNames:['discover-playlist-story'],
  classNameBindings:['isPlaying', 'isCurrentTrack']
});
