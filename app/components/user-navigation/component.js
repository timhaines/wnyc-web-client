import Component from 'ember-component';
import service from 'ember-service/inject';

export default Component.extend({
  session: service(),
  metrics: service(),
  isPopupOpen: false,
  classNameBindings: ['isPopupOpen'],
  actions: {
    closePopup() {
      if ( !(this.get('isDestroyed') || this.get('isDestroying')) ) {
        this.set('isPopupOpen', false);
      }
    },
    togglePopup() {
      this.toggleProperty('isPopupOpen');
    },
    logout() {
      this.get('metrics').trackEvent({
        category: 'WNYC Menu',
        label: 'Clicked Logout',
      });
      this.get('session').invalidate();
    }
  }
});
