export class ScrollHandler{
  constructor(){
    this.listener = null;
    this.view = null;
    this.indicator = null;
    this.relative = null;
    this.offset = null;
    this.reference = null;
    this.passed = null;
    this.velocity = null;
    this.frame = null;
    this.timestamp = null;
    this.ticker = null;
    this.amplitude = null;
    this.target = null;
    this.timeConstant = 325;
    this.firefoxMultitude = 30;
    this.mouseMultitude = 1;
    this.keyStep = 120;
    this.isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    this.hasTouchWin = navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 1;
    this.hasPointer = !!window.navigator.msPointerEnabled;
    this.hasKeyDown = 'onkeydown' in document;
    this.hasWheelEvent = 'onwheel' in document;
    this.hasMouseWheelEvent = 'onmousewheel' in document;
    this.prevFrame = 0;
    this.touchOnSameFrameCount = 0;
  }

  initialize(view, listener){
    this.listener = listener;

    if(this.hasWheelEvent){
      view.addEventListener("wheel", e => this.wheel(e));
    }

    if(this.hasMouseWheelEvent){
      view.addEventListener("mousewheel", e => this.mouseWheel(e));
    }

    if (typeof window.ontouchstart !== 'undefined') {
      view.addEventListener('touchstart', e => this.touchStart(e));
      view.addEventListener('touchmove', e => this.touchMove(e));
      view.addEventListener('touchend', e => this.touchEnd(e));
    }

    if(this.hasPointer && this.hasTouchWin) {
      this.bodyTouchAction = document.body.style.msTouchAction;
      view.body.style.msTouchAction = "none";
      view.addEventListener("MSPointerDown", e => this.tap(e), true);
      view.addEventListener("MSPointerMove", e => this.drag(e), true);
    }

    if(this.hasKeyDown){
      view.addEventListener("keydown", e => this.keyDown(e), false);
    }

    this.offset = 0;
    this.pressed = false;
  }

  ypos(event){
    if (event.targetTouches && (event.targetTouches.length >= 1)) {
      return event.targetTouches[0].clientY;
    }

    return event.clientY;
  }

  autoScroll() {
    var elapsed, delta;
    if (this.amplitude) {
      elapsed = Date.now() - this.timestamp;
      delta = this.amplitude * Math.exp(-elapsed / this.timeConstant);
      if (delta > 0.5 || delta < -0.5) {
        this.offset = this.listener(delta);
        requestAnimationFrame(() => this.autoScroll());
      }
    }
  }

  track() {
    var now, elapsed, delta, v;

    now = Date.now();
    elapsed = now - this.timestamp;
    this.timestamp = now;
    delta = this.offset - this.frame;
    this.frame = this.offset;

    v = 1000 * delta / (1 + elapsed);
    this.velocity = 0.3 * v + 0.2 * this.velocity;
  }

  touchMove(event) {
    var y, delta;
    if (this.pressed) {
      y = this.ypos(event);
      delta = this.reference - y;
      if (delta > 2 || delta < -2) {
        this.reference = y;
        this.offset = this.listener(-delta);
      }
    }
    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  touchStart(event) {
    this.pressed = true;
    this.reference = this.ypos(event);

    this.velocity = this.amplitude = 0;
    this.frame = this.offset;
    this.timestamp = Date.now();
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.track(), 10);

    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  touchEnd(event) {
    this.pressed = false;

    clearInterval(this.ticker);
    if (this.velocity > 10 || this.velocity < -10) {
      this.amplitude = 0.2 * this.velocity;
      this.target = Math.round(this.offset + this.amplitude);
      this.timestamp = Date.now();
      requestAnimationFrame(() => this.autoScroll());
    }

    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  mouseWheel(event) {
    var delta = (event.wheelDeltaY) ? event.wheelDeltaY : event.wheelDelta;

    this.offset = this.listener(delta);
  }

  wheel(event) {
    var delta = event.wheelDeltaY || event.deltaY;

    if(this.isFirefox && event.deltaMode == 1) {
      delta *= this.firefoxMultitude;
      delta = -delta;
    }

    delta *= this.mouseMultitude;

    this.offset = this.listener(delta, 0.1);
  }

  keyDown(event) {
    var delta = 0;
    switch(event.keyCode) {
      case 38:
        delta = this.keyStep;
        break;
      case 40:
        delta = -this.keyStep;
        break;
    }

    this.offset = this.listener(delta);
  }

  dispose(){
    // TODO Implement
  }
}
