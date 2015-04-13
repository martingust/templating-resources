import {inject} from 'aurelia-dependency-injection';
import {ObserverLocator, calcSplices, getChangeRecords} from 'aurelia-binding';
import {BoundViewFactory, ViewSlot, customAttribute, bindable, templateController} from 'aurelia-templating';

@customAttribute('virtual-repeat')
@bindable('items')
@bindable('local')
@templateController
@inject(Element, BoundViewFactory, ViewSlot, ObserverLocator)
export class VirtualRepeat {
  constructor(element, viewFactory, viewSlot, observerLocator){
    this.element = element;
    this.viewFactory = viewFactory;
    this.viewSlot = viewSlot;
    this.observerLocator = observerLocator;
    this.local = 'item';
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
    this.ease = 0.1;
    this.targetY = 0;
    this.currentY = 0;
    this.previousY = 0;
    this.first = 0;
    this.previousFirst = 0;
    this.isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    this.numberOfDomElements = 0;
    this.event = {
      y: 0,
      x: 0,
      deltaX: 0,
      deltaY: 0,
      originalEvent: null
    };
  }

  bind(executionContext){
    this.executionContext = executionContext;
    this.virtualScroll = this.element.parentElement.parentElement;
    this.virtualScrollInner = this.element.parentElement;
    this.virtualScroll.addEventListener('touchmove', function(e) { e.preventDefault(); });

    this.initialize(this.virtualScroll, target => {
      this.targetY += target.deltaY;
      this.targetY = Math.max(-this.scrollViewHeight, this.targetY);
      this.targetY = Math.min(0, this.targetY);
    });

    // create first item to get the heights
    var row = this.createFullExecutionContext(this.items[0], 0, 1);
    var view = this.viewFactory.create(row);
    this.viewSlot.add(view);
  }

  attached(){
    var virtualScrollHeight, row, view;
    this.listItems = this.element.parentElement.children;
    this.itemHeight = this.listItems[0].getBoundingClientRect().height;
    virtualScrollHeight = this.virtualScroll.getBoundingClientRect().height;
    this.numberOfDomElements = Math.ceil(virtualScrollHeight / this.itemHeight) + 1;

    for(var i = 1, ii = this.numberOfDomElements; i < ii; ++i){
      row = this.createFullExecutionContext(this.items[i], i, ii);
      view = this.viewFactory.create(row);
      this.viewSlot.add(view);
    }

    this.calculateScrollViewHeight();
    this.processItems();
  }

  processItems(){
    var items = this.items,
      i, ii, observer;

    observer = this.observerLocator.getArrayObserver(items);

    // very temp for debugging
    for(i = 1, ii = this.virtualScrollInner.children.length; i < ii; ++i){
      var node = this.virtualScrollInner.children[i];
      node.className = node.className + ' ' + i;
    }

    this.disposeSubscription = observer.subscribe(splices => {
      this.handleSplices(items, splices);
    });

    this.scroll();
  }

  scroll() {
    var scrollView = this.virtualScrollInner,
      itemHeight = this.itemHeight,
      items = this.items,
      viewSlot = this.viewSlot,
      numberOfDomElements =  this.numberOfDomElements,
      node, marginTop, translateStyle, view, first;

    this.currentY += (this.targetY - this.currentY) * this.ease;
    this.currentY = Math.round(this.currentY * 1);

    if(this.currentY === this.previousY){
      requestAnimationFrame(() => this.scroll());
      return;
    }

    this.previousY = this.currentY;
    this.first = Math.ceil(this.currentY / itemHeight) * -1;
    first = this.first;

    if(first > this.previousFirst && first + numberOfDomElements - 1 <= items.length){
      this.previousFirst = first;

      view = viewSlot.children[0];
      view.executionContext = this.updateExecutionContext(view.executionContext, first + numberOfDomElements - 1, items.length);
      view.executionContext[this.local] = items[first + numberOfDomElements - 1];
      viewSlot.children.push(viewSlot.children.shift());

      node = scrollView.children[0];
      scrollView.insertBefore(node, scrollView.children[numberOfDomElements]);

      marginTop = itemHeight * first + "px";
      scrollView.style.marginTop = marginTop;

    }else if (first < this.previousFirst){
      this.previousFirst = first;

      view = viewSlot.children[numberOfDomElements - 1];
      view.executionContext[this.local] = items[first];
      view.executionContext = this.updateExecutionContext(view.executionContext, first, items.length);
      viewSlot.children.unshift(viewSlot.children.splice(-1,1)[0]);

      node = scrollView.children[numberOfDomElements - 1];
      scrollView.insertBefore(node, scrollView.children[0]);

      marginTop = itemHeight * first + "px";
      scrollView.style.marginTop = marginTop;
    }

    translateStyle = "translate3d(0px," + this.currentY + "px,0px)";

    this.virtualScrollInner.style.webkitTransform = translateStyle;
    this.virtualScrollInner.style.msTransform = translateStyle;
    this.virtualScrollInner.style.transform = translateStyle;

    requestAnimationFrame(() => this.scroll());
  }

  createBaseExecutionContext(data){
    var context = {};
    context[this.local] = data;
    return context;
  }

  createFullExecutionContext(data, index, length){
    var context = this.createBaseExecutionContext(data);
    return this.updateExecutionContext(context, index, length);
  }

  updateExecutionContext(context, index, length){
    var first = (index === 0),
      last = (index === length - 1),
      even = index % 2 === 0;

    context.$parent = this.executionContext;
    context.$index = index;
    context.$first = first;
    context.$last = last;
    context.$middle = !(first || last);
    context.$odd = !even;
    context.$even = even;

    return context;
  }

  handleSplices(items, splices){
    var numberOfDomElements = this.numberOfDomElements,
      viewSlot = this.viewSlot,
      first = this.first,
      totalAdded = 0,
      i, ii, view, marginTop, addIndex, splice, end, atBottom;
    this.items = items;

    for(i = 0, ii = viewSlot.children.length; i < ii; ++i){
      view = viewSlot.children[i];
      view.executionContext[this.local] = items[first + i];
      view.executionContext = this.updateExecutionContext(view.executionContext, first + i, items.length);
      if(!view.executionContext[this.local]){
        viewSlot.removeAt(view.executionContext.$index);
      }
    }

    for(i = 0, ii = splices.length; i < ii; ++i){
      splice = splices[0];
      addIndex = splices[i].index;
      end = splice.index + splice.addedCount;
      totalAdded += splice.addedCount;

      for (; addIndex < end; ++addIndex) {
        if(addIndex < first + numberOfDomElements && !atBottom){
          marginTop = this.itemHeight * first + "px";
          this.virtualScrollInner.style.marginTop = marginTop;
        }
      }
    }

    this.calculateScrollViewHeight();
  }

  handleSplicesOld(items, splices){
    var numberOfDomElements = this.numberOfDomElements,
      viewSlot = this.viewSlot,
      first = this.first,
      totalAdded = 0,
      i, ii, j, k, view, marginTop, addIndex, domAddIndex,
      childIndex, splice, end, children, length, spliceIndexLow;
    this.items = items;

    for(i = 0, ii = splices.length; i < ii; ++i){
      splice = splices[0];
      addIndex = splices[i].index;
      end = splice.index + splice.addedCount;
      totalAdded += splice.addedCount;

      for (; addIndex < end; ++addIndex) {
        if(addIndex < first + numberOfDomElements){
          spliceIndexLow = !spliceIndexLow ? first : spliceIndexLow;
          childIndex = numberOfDomElements - 1;
          view = viewSlot.children[childIndex];
          view.executionContext.item = items[addIndex];
          domAddIndex = addIndex - first;
          VirtualRepeat.moveItem(viewSlot.children, childIndex, domAddIndex);

          if(childIndex !== addIndex - first){
            var node = this.virtualScrollInner.children[childIndex];
            this.virtualScrollInner.insertBefore(node, this.virtualScrollInner.children[domAddIndex]);

            marginTop = this.itemHeight * first + "px";
            this.virtualScrollInner.style.marginTop = marginTop;
          }
        }
      }
    }

    this.calculateScrollViewHeight();

    children = viewSlot.children;
    length = children.length;
    for(j = 0; j < length; j++){
      this.updateExecutionContext(children[j].executionContext, children[j].executionContext.$index + totalAdded, length);
    }
  }

  calculateScrollViewHeight(){
    // TODO Find better way to get total height
    // 1.1 for bottom margin
    this.scrollViewHeight = (this.items.length * this.itemHeight) - ((this.numberOfDomElements - 1) * this.itemHeight) + 1 * this.itemHeight;
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
    this.touchStartX = t.pageX;
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

  // http://jsperf.com/array-prototype-move
  static moveItem(array, pos1, pos2) {
    // local variables
    var i, tmp;
    // cast input parameters to integers
    pos1 = parseInt(pos1, 10);
    pos2 = parseInt(pos2, 10);
    // if positions are different and inside array
    if (pos1 !== pos2 && 0 <= pos1 && pos1 <= array.length && 0 <= pos2 && pos2 <= array.length) {
      // save element from position 1
      tmp = array[pos1];
      // move element down and shift other elements up
      if (pos1 < pos2) {
        for (i = pos1; i < pos2; i++) {
          array[i] = array[i + 1];
        }
      }
      // move element up and shift other elements down
      else {
        for (i = pos1; i > pos2; i--) {
          array[i] = array[i - 1];
        }
      }
      // put element from position 1 to destination
      array[pos2] = tmp;
    }
  }
}
