import Ember from 'ember';

export default Ember.Route.extend({
  titleToken: 'Sign In',
  setupController() {
    this.send('disableChrome');
  },
  actions: {
    willTransition() {
      this.send('enableChrome');
    }
  }
});
