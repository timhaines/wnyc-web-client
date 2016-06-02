import Ember from 'ember';
import config from 'overhaul/config/environment';

export default Ember.Component.extend({
  svgURL: config.wnycSvgURL,
  actions: {
    textEntered(val){
      this.sendAction('action', val);
    }
  }
});