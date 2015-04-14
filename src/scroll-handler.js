export class ScrollHandler{
  constructor(){
    this.touchMultitude = 1;
    this.firefoxMultitude = 15;
    this.mouseMultitude = 1;
    this.keyStep = 120;
    this.listeners = [];
    this.initialized = false;
    this.hasWheelEvent = 'onwheel' in document;
    this.hasMouseWheelEvent = 'onmousewheel' in document;
    this.hasTouch = 'ontouchstart' in document;
    this.hasKeyDown = 'onkeydown' in document;
    this.hasTouchWin = navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 1;
    this.hasPointer = !!window.navigator.msPointerEnabled;
    this.isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    this.event = {
      y: 0,
      x: 0,
      deltaX: 0,
      deltaY: 0,
      originalEvent: null
    };
  }

  initialize(element, listener){
    if(!this.initialized){
      this.initListeners(element);
    }
    this.listeners.push(listener);
  }

  initListeners(element) {
    if(this.hasWheelEvent) element.addEventListener("wheel", e => this.onWheel(e));
    if(this.hasMouseWheelEvent) element.addEventListener("mousewheel", e => this.onMouseWheel(e));

    if(this.hasTouch) {
      element.addEventListener("touchstart", e => this.onTouchStart(e));
      element.addEventListener("touchmove", e => this.onTouchMove(e));
    }

    if(this.hasPointer && this.hasTouchWin) {
      this.bodyTouchAction = document.body.style.msTouchAction;
      element.body.style.msTouchAction = "none";
      element.addEventListener("MSPointerDown", e => this.onTouchStart(e), true);
      element.addEventListener("MSPointerMove", e => this.onTouchMove(e), true);
    }

    if(this.hasKeyDown){
      element.addEventListener("keydown", e => this.onKeyDown(e), false);
    }

    this.initialized = true;
  }

  notify(event) {
    var i, ii;
    this.event.x += this.event.deltaX;
    this.event.y += this.event.deltaY;
    this.event.originalEvent = event;

    for(i = 0, ii = this.listeners.length; i < ii; ++i) {
      this.listeners[i](this.event);
    }
  }

  onWheel(event) {
    this.event.deltaX = event.wheelDeltaX || event.deltaX * -1;
    this.event.deltaY = event.wheelDeltaY || event.deltaY * -1;

    if(this.isFirefox && event.deltaMode == 1) {
      this.event.deltaX *= this.firefoxMultitude;
      this.event.deltaY *= this.firefoxMultitude;
    }

    this.event.deltaX *= this.mouseMultitude;
    this.event.deltaY *= this.mouseMultitude;

    this.notify(event);
  }

  onMouseWheel(event) {
    this.event.deltaX = (event.wheelDeltaX) ? event.wheelDeltaX : 0;
    this.event.deltaY = (event.wheelDeltaY) ? event.wheelDeltaY : event.wheelDelta;

    this.notify(event);
  }

  onTouchStart(event) {
    var t = (event.targetTouches) ? event.targetTouches[0] : event;
    this.pressed = true;
    this.touchStartY = t.pageY;

  }

  onTouchMove(event) {
    var t = (event.targetTouches) ? event.targetTouches[0] : event;

    this.event.deltaX = (t.pageX - this.touchStartX) * this.touchMultitude;
    this.event.deltaY = (t.pageY - this.touchStartY) * this.touchMultitude;

    this.touchStartX = t.pageX;
    this.touchStartY = t.pageY;

    this.notify(event);
  }

  onKeyDown(event) {
    this.event.deltaX = this.event.deltaY = 0;
    switch(event.keyCode) {
      case 37:
        this.event.deltaX = -this.keyStep;
        break;
      case 39:
        this.event.deltaX = this.keyStep;
        break;
      case 38:
        this.event.deltaY = this.keyStep;
        break;
      case 40:
        this.event.deltaY = -this.keyStep;
        break;
    }

    this.notify(event);
  }
}
