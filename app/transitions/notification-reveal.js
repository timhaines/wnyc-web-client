import { animate } from 'liquid-fire';

export default function() {
  if (this.newValue) {
    this.newElement.css('visibility', '');
    let notification = this.newElement.find('.js-player-notification');
    notification.css({ transform: 'translateY(0)', 'z-index': 1200 });
    let notificationAnimationOptions = {easing: [0.17, 0.89, 1, 1], duration: 500};
    return animate(notification, {translateY: [0, '80px']}, notificationAnimationOptions);
  } else {
    let notification = this.oldElement.find('.js-player-notification');
    notification.css({ transform: 'translateY(80px)', 'z-index': 1200 });
    let notificationAnimationOptions = {easing: [0.17, 0.89, 1, 1], duration: 500};
    return animate(notification, {translateY: ['80px', 0]}, notificationAnimationOptions);
  }
}
