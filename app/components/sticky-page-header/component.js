import Component from 'ember-component';
import { htmlSafe } from 'ember-string';
import computed from 'ember-computed';
import { schedule } from 'ember-runloop';

export default Component.extend({
  offset: 0,
  spacerHeight: 0,
  
  spacerStyle: computed('spacerHeight', function() {
    return htmlSafe(`height: ${this.get('spacerHeight')}px;`);
  }),
  
  didRender() {
    let height = this.$('.sticky-page-header').height();
    if (!this.get('sticky')) {
      height = 0;
    }
    schedule('afterRender', this, () => this.set('spacerHeight', height));
  },
  
  actions: {
    trigger(direction) {
      let sticky = direction === 'down';
      this.set('sticky', sticky);
    },
  },
});
