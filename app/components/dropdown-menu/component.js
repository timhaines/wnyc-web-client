import Component from 'ember-component';

export default Component.extend({
  classNames: ['dropdown', 'dropdown--br', 'dropdown--nearwhite'],
  classNameBindings: ['isOpen'],
  isOpen: false,
  
  actions: {
    toggleDropdown() {
      this.toggleProperty('isOpen');
    }
  }
});
