import DS from 'ember-data';
const {
  Model,
  attr
} = DS;

export default Model.extend({
  email:              attr('string'),
  givenName:          attr('string'),
  familyName:         attr('string'),
  preferredUsername:  attr('string'),
  picture:            attr('string'),
  facebookId:         attr('string')
});
