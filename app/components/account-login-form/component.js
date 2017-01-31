import Component from 'ember-component';
import set from 'ember-metal/set';
import get from 'ember-metal/get';
import Changeset from 'ember-changeset';
import LoginValidations from 'wnyc-web-client/validations/login';
import lookupValidator from 'ember-changeset-validations';
import ENV from 'wnyc-web-client/config/environment';
import service from 'ember-service/inject';

export default Component.extend({
  resendEndpoint: `${ENV.wnycAuthAPI}/v1/confirm/resend`,
  session: service(),
  allowedKeys: ['email', 'password'],
  triedUnverifiedAccount: false,
  init() {
    this._super(...arguments);
    set(this, 'fields', {
      email: '',
      password: ''
    });
    set(this, 'changeset', new Changeset(get(this, 'fields'), lookupValidator(LoginValidations), LoginValidations));
    get(this, 'changeset').validate();
  },
  actions: {
    onSubmit() {
      return this.authenticate(get(this, 'fields.email'), get(this, 'fields.password'));
    },
    onFailure(e) {
      if (e) {
        if (get(e, 'errors.code') === 'AccountNotConfirmed') {
          set(this, 'triedUnconfirmedAccount', true);
        } else {
          this.applyErrorToChangeset(e.errors, get(this, 'changeset'));
        }
      }
    },
  },
  authenticate(email, password) {
    return get(this, 'session').authenticate('authenticator:nypr', email, password);
  },
  applyErrorToChangeset(error, changeset) {
    if (error && error.code) {
      if (error.code === "UnauthorizedAccess") {
        changeset.validate('password');
        changeset.pushErrors('password', `There was a problem with the email and/or password for ${changeset.get('email')}. <a href="/signup">Sign up?</a> <a href="/forgot">Forgot password?</a>`);
      } else if (error.code === "UserNotFoundException") {
        changeset.validate('email');
        changeset.pushErrors('email', `We cannot find an account for the email ${changeset.get('email')}. <a href="/signup">Sign up?</a>`);
      }
    }
  }
});
