import { test } from 'qunit';
import moduleForAcceptance from 'overhaul/tests/helpers/module-for-acceptance';
import { authenticateSession } from 'overhaul/tests/helpers/ember-simple-auth';
import config from 'overhaul/config/environment';

moduleForAcceptance('Acceptance | profile');

test('unauthenticated visiting /profile', function(assert) {
  visit('/profile');

  andThen(function() {
    assert.equal(currentURL(), '/login');
  });
});

test('authenticated visiting /profile', function(assert) {
  authenticateSession(this.application, {access_token: 'foo'});
  server.create('user');
  
  visit('/profile');
  
  andThen(function() {
    assert.equal(currentURL(), '/profile');
  });
});

test('can view & update attrs', function(assert) {
  const FIRST = 'zzzzz';
  const LAST = 'xxxxx';
  const USER = 'yyyyy';
  const EMAIL = 'wwwww@ww.ww';
  const PW = '1234567890';
  let {
    given_name,
    family_name,
    preferred_username,
    email
  } = server.create('user');
  
  server.post(`${config.wnycAuthAPI}/v1/session`, (schema, {requestBody}) => {
    let body = requestBody.split('&').map(s => ({[s.split('=')[0]]: s.split('=')[1]}));
    assert.equal(decodeURIComponent(body.findBy('username').username), email);
    assert.equal(body.findBy('password').password, PW);
    return {access_token: 'secret', expires_in: 3600, token_type: 'bearer'};
  });
   
  server.patch(`${config.wnycAuthAPI}/v1/user`, (schema, request) => {
    assert.equal(request.requestHeaders.Authorization, 'Bearer secret');
    
    return {
      data: {
        type: 'user',
        id: '1',
        attributes: JSON.parse(request.requestBody)
      }
    };
  });
   
  authenticateSession(this.application, {access_token: 'foo'});
  visit('/profile');
  
  andThen(function() {
    assert.equal(findWithAssert('input[name=fullName]').val(), `${given_name} ${family_name}`, 'displays old fullname');
    assert.equal(findWithAssert('input[name=preferredUsername]').val(), preferred_username, 'displays old username');
    assert.equal(findWithAssert('input[name=email]').val(), email, 'displays old email');
    assert.equal(findWithAssert('input[name=password]').val(), '********', 'displays password asterisks');
  });
  
  andThen(function() {
    click('.nypr-basic-info [data-test-selector="edit-button"]');
  });
  
  andThen(function() {
    fillIn('input[name=givenName]', FIRST);
    fillIn('input[name=familyName]', LAST);
    fillIn('input[name=preferredUsername]', USER);
    fillIn('input[name=email]', EMAIL);

    find('input[name=email]').click();
    fillIn('input[name=confirmEmail]', EMAIL);
  });
  
  click('.nypr-basic-info [data-test-selector="save"]');
  
  andThen(function() {
    fillIn('[name=passwordForEmailChange]', PW);
    click('[data-test-selector=check-pw]');
  });
  
  andThen(function() {
    assert.ok(findWithAssert('.alert-success').length, 'shows flash message');
    assert.equal(findWithAssert('input[name=fullName]').val(), `${FIRST} ${LAST}`, 'displays new fullname');
    assert.equal(findWithAssert('input[name=preferredUsername]').val(), USER, 'displays new username');
    assert.equal(findWithAssert('input[name=email]').val(), EMAIL, 'displays new email');
    assert.equal(findWithAssert('input[name=password]').val(), '********', 'displays password asterisks');
  });
});

test('can update password', function(assert) {
  const OLD = '1234567890';
  const NEW = '0987654321';
  server.create('user');  
  server.post(`${config.wnycAuthAPI}/v1/password`, (schema, request) => {
    let body = JSON.parse(request.requestBody);
    assert.equal(request.requestHeaders.authorization, 'Bearer foo');
    assert.equal(request.requestHeaders['content-type'], 'application/json');
    assert.deepEqual(body, {old_password: OLD, new_password: NEW});
  });
   
  authenticateSession(this.application, {access_token: 'foo'});
  visit('/profile');
  
  click('.nypr-password-card [data-test-selector="edit-button"]');
  
  andThen(function() {
    fillIn('input[name=currentPassword]', OLD);
    fillIn('input[name=newPassword]', NEW);
  });
  
  click('.nypr-password-card [data-test-selector="save"]');
});

test('can disable account', function(assert) {
  assert.expect(1);
  
  server.create('user');  
  server.delete(`${config.wnycAuthAPI}/v1/user`, (schema, {requestHeaders}) => {
    assert.equal(requestHeaders.Authorization, 'Bearer foo');
  });
   
  authenticateSession(this.application, {access_token: 'foo'});
  visit('/profile');
  
  click('[data-test-selector="disable-account"]');
  
  andThen(function() {
    click('[data-test-selector="do-disable"]');
  });
  
  andThen(function() {
    click('[data-test-selector="confirm-disable"]');
  });
});