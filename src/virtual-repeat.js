import {inject} from 'aurelia-dependency-injection';
import {ObserverLocator, calcSplices, getChangeRecords} from 'aurelia-binding';
import {BoundViewFactory, ViewSlot, customAttribute, bindable, templateController} from 'aurelia-templating';
import {ScrollListener} from './scroll-listener';

@customAttribute('virtual-repeat')
@bindable('items')
@bindable('local')
@templateController
@inject(Element, BoundViewFactory, ViewSlot, ObserverLocator, ScrollListener)
export class VirtualRepeat {
  constructor(element, viewFactory, viewSlot, observerLocator, scrollListener){
    this.element = element;
    this.viewFactory = viewFactory;
    this.viewSlot = viewSlot;
    this.observerLocator = observerLocator;
    this.scrollListener = scrollListener;
    this.local = 'item';
    this.ease = 0.1;
    this.targetY = 0;
    this.currentY = 0;
    this.previousY = 0;
    this.first = 0;
    this.previousFirst = 0;
    this.numberOfDomElements = 0;
  }

  bind(executionContext){    
    this.executionContext = executionContext;
    this.virtualScroll = this.element.parentElement.parentElement;
    this.virtualScroll.style.overflow = 'hidden';
    this.virtualScroll.tabIndex = '999';
    this.virtualScrollInner = this.element.parentElement;
    this.virtualScroll.addEventListener('touchmove', function(e) { e.preventDefault(); });

    this.scrollListener.initialize(this.virtualScroll,  deltaY => {
       this.targetY += deltaY;
      console.log('this.scrollViewHeight ' + this.scrollViewHeight);
      console.log('this.targetY ' + this.targetY);
       this.targetY = Math.max(-this.scrollViewHeight, this.targetY);
       this.targetY = Math.min(0, this.targetY);
       return this.targetY;
    });

    // create first item to get the heights
    var row = this.createFullExecutionContext(this.items[0], 0, 1);
    var view = this.viewFactory.create(row);
    this.viewSlot.add(view);
  }

  unbind(){
    this.scrollListener.dispose();
  }

  scrollListener(target){
    this.targetY += target.deltaY;
    this.targetY = Math.max(-this.scrollViewHeight, this.targetY);
    this.targetY = Math.min(0, this.targetY);
  }

  attached(){
    var row, view;
    this.listItems = this.virtualScrollInner.children;
    this.itemHeight = VirtualRepeat.calcOuterHeight(this.listItems[0]);
 
    this.virtualScrollHeight = this.virtualScroll.getBoundingClientRect().height;
    this.numberOfDomElements = Math.ceil(this.virtualScrollHeight / this.itemHeight) + 1;

    for(var i = 1, ii = this.numberOfDomElements; i < ii; ++i){
      row = this.createFullExecutionContext(this.items[i], i, ii);
      view = this.viewFactory.create(row);
      this.viewSlot.add(view);
    }
    this.calcScrollViewHeight();
    this.processItems();
  }

  static calcOuterHeight(element){
    var height, style, marginTop, marginBottom;
    height = element.getBoundingClientRect().height;
    style = element.currentStyle || window.getComputedStyle(element);
    marginTop = parseInt(style.marginTop);
    marginBottom = parseInt(style.marginBottom);
    height += Number.isNaN(marginTop) ? 0 : marginTop;
    height += Number.isNaN(marginBottom) ? 0 : marginBottom;
    return height;
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
      i, ii, j, view, marginTop, addIndex, splice, end, atBottom;
    this.items = items;

    for(i = 0, ii = viewSlot.children.length; i < ii; ++i){
      view = viewSlot.children[i];
      view.executionContext[this.local] = items[first + i];
      view.executionContext = this.updateExecutionContext(view.executionContext, first + i, items.length);
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

    if(items.length < numberOfDomElements){
      var limit = numberOfDomElements - (numberOfDomElements - items.length) - 1;
      for(j = 0; j < numberOfDomElements; ++j){
        this.virtualScrollInner.children[j].style.display = j >= limit ? 'none' : 'block';
      }
    }

    this.calcScrollViewHeight();
  }

  calcScrollViewHeight(){
    // TODO Might need bottom margin
    this.scrollViewHeight = (this.items.length * this.itemHeight) - this.virtualScrollHeight;
  }
}
