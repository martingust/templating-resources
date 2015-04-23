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
    this.firefoxMultitude = 15;
    this.mouseMultitude = 1;
    this.keyStep = 120;
    this.isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    this.hasTouchWin = navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 1;
    this.hasPointer = !!window.navigator.msPointerEnabled;
    this.hasKeyDown = 'onkeydown' in document;
  }

  initialize(view, listener){
    this.listener = listener;

    if('onwheel' in document){
      view.addEventListener("wheel", e => this.onWheel(e));
    }

    if('onmousewheel' in document){
      view.addEventListener("mousewheel", e => this.onMouseWheel(e));
    }

    if (typeof window.ontouchstart !== 'undefined') {
      view.addEventListener('touchstart', e => this.tap(e));
      view.addEventListener('touchmove', e => this.drag(e));
      view.addEventListener('touchend', e => this.release(e));
    }

    if(this.hasPointer && this.hasTouchWin) {
      this.bodyTouchAction = document.body.style.msTouchAction;
      view.body.style.msTouchAction = "none";
      view.addEventListener("MSPointerDown", e => this.tap(e), true);
      view.addEventListener("MSPointerMove", e => this.drag(e), true);
    }

    if(this.hasKeyDown){
      view.addEventListener("keydown", e => this.onKeyDown(e), false);
    }

    this.offset = 0;
    this.pressed = false;
  }

  ypos(e){
    // touch event
    if (e.targetTouches && (e.targetTouches.length >= 1)) {
      return e.targetTouches[0].clientY;
    }

    // mouse event
    return e.clientY;
  }

  track() {
    var now, elapsed, delta, v;

    now = Date.now();
    elapsed = now - this.timestamp;
    this.timestamp = now;
    delta = this.offset - this.frame;
    this.frame = this.offset;

    v = 1000 * delta / (1 + elapsed);
    this.velocity = 0.8 * v + 0.2 * this.velocity;
  }

  autoScroll() {
    var elapsed, delta;

    if (this.amplitude) {
      elapsed = Date.now() - this.timestamp;
      delta = -this.amplitude * Math.exp(-elapsed / this.timeConstant);
      if (delta > 0.5 || delta < -0.5) {
        this.offset = this.listener(delta);
        requestAnimationFrame(() => this.autoScroll());
      } else {
        //this.offset = this.listener(this.target);
      }
    }
  }

  tap(e) {
    this.pressed = true;
    this.reference = this.ypos(e);

    this.velocity = this.amplitude = 0;
    this.frame = this.offset;
    this.timestamp = Date.now();
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.track(), 100);

    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  drag(e) {
    var y, delta;
    if (this.pressed) {
      y = this.ypos(e);
      delta = this.reference - y;
      if (delta > 2 || delta < -2) {
        this.reference = y;
        console.log('offset: ' + this.offset);
        console.log('delta: ' + delta);
        this.offset = this.listener(delta);
      }
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  onMouseWheel(event) {
    var delta = (event.wheelDeltaY) ? -event.wheelDeltaY : -event.wheelDelta;

    this.offset = this.listener(delta);
  }

  onWheel(event) {
    var delta = event.wheelDeltaY || event.deltaY * -1;

    if(this.isFirefox && event.deltaMode == 1) {
      delta *= this.firefoxMultitude;
    }

    delta *= this.mouseMultitude;

    this.offset = this.listener(-delta);
  }

  onKeyDown(event) {
    var delta = 0;
    switch(event.keyCode) {
      case 38:
        delta = this.keyStep;
        break;
      case 40:
        delta = -this.keyStep;
        break;
    }

    this.offset = this.listener(-delta);
  }

  release(e) {
    this.pressed = false;

    clearInterval(this.ticker);
    if (this.velocity > 10 || this.velocity < -10) {
      this.amplitude = 0.1 * this.velocity;
      this.target = Math.round(this.offset + this.amplitude);
      this.timestamp = Date.now();
      requestAnimationFrame(() => this.autoScroll());
    }

    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}
