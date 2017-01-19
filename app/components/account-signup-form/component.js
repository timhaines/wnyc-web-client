import Component from 'ember-component';
import get from 'ember-metal/get';
import set from 'ember-metal/set';
import Changeset from 'ember-changeset';
import SignupValidations from 'wnyc-web-client/validations/signup';
import lookupValidator from 'ember-changeset-validations';
import service from 'ember-service/inject';
import observer from 'ember-metal/observer';
import ENV from 'wnyc-web-client/config/environment';
import fetch from 'fetch';
import { rejectUnsuccessfulResponses } from 'wnyc-web-client/utils/fetch-utils';

export default Component.extend({
  store: service(),
  allowedKeys: ['email','emailConfirmation','givenName','familyName','typedPassword'],
  init() {
    this._super(...arguments);
    set(this, 'newUser', this.get('store').createRecord('user'));
    set(this, 'changeset', new Changeset(get(this, 'newUser'), lookupValidator(SignupValidations), SignupValidations));
    get(this, 'changeset').validate();
  },
  
  emailObserver: observer('changeset.email', function() {
    if (get(this, 'changeset.emailConfirmation')) {
      get(this, 'changeset').validate('emailConfirmation');
    }
  }),

  actions: {
    onSubmit() {
      return this.signUp();
    },
    onFailure(e) {
      if (e.errors) {
        this.applyErrorToChangeset(e.errors, get(this, 'changeset'));
      }
    },
  },
  signUp() {
    return get(this, 'newUser').save();
  },
  applyErrorToChangeset(error, changeset) {
    if (error) {
      if (error.code === "UsernameExistsException") {
        changeset.validate('email');
        changeset.pushErrors('email', 'an account already exists for that email. <a href="/accounts/login">Log in</a>');
      } else {
        console.log(error);
      }
    }
  },
  resendConfirmationEmail(email) {
    let url = `${ENV.wnycAuthAPI}/v1/confirm/resend?email=${email}`;
    let method = 'GET';
    let mode = 'cors';
    return fetch(url, {method, mode})
    .then(rejectUnsuccessfulResponses);
  }
});
