import Controller from 'ember-controller';

export default Controller.extend({
  queryParams: ['confirmation', 'email'],
  confirmation: null,
  email: null
});
