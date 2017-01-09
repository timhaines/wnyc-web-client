import PageObject from 'wnyc-web-client/tests/page-object';

let {
  visitable,
  clickOnText,
  clickable,
  textList,
  text,
  isVisible
} = PageObject;

export default PageObject.create({
  visit: visitable(':id'),
  clickNavLink: clickOnText('.tabs-header'),
  storyTitles: textList('[data-test-selector=story-tease-title]'),
  aboutText: text('[data-test-selector=about-page]'),
  storyText: text('[data-test-selector=story-detail]'),
  clickNext: clickable('.pagefooter-next > a'),
  clickBack: clickable('.pagefooter-previous > a'),
  clickPage: clickOnText('.pagefooter-link'),
  facebookIsVisible: isVisible('a[href="http://facebook.com"]')
});
