import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('account-signup-form', 'Integration | Component | account signup form', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{account-login-form}}`);
  assert.equal(this.$('.account-form').length, 1);
});

test('submitting the form tries to save values on a new user model', function(assert) {
  let save = sinon.stub().returns(Promise.reject({}));
  let fakeUser = {save};
  let createRecord = sinon.stub().returns(fakeUser);
  let store = {createRecord};
  this.set('store', store);
  this.render(hbs`{{account-signup-form store=store}}`);

  let testFirstName = 'Test';
  let testLastName = 'User';
  let testEmail = 'test@email.com';
  let testPassword = 'password123';

  this.$('label:contains(First Name) + input').val(testFirstName);
  this.$('label:contains(First Name) + input').change();
  this.$('label:contains(Last Name) + input').val(testLastName);
  this.$('label:contains(Last Name) + input').change();
  this.$('label:contains(Email) + input').val(testEmail);
  this.$('label:contains(Email) + input').change();
  this.$('label:contains(Password) + input').val(testPassword);
  this.$('label:contains(Password) + input').change();
  this.$('button:contains(Sign up)').click();

  delete fakeUser.save;
  assert.ok(createRecord.calledOnce);
  assert.ok(save.calledOnce);
  assert.deepEqual(fakeUser, {
    givenName: testFirstName,
    familyName: testLastName,
    email: testEmail,
    typedPassword: testPassword
  });
});
