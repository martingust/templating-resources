import {inject} from 'aurelia-dependency-injection';
import {ObserverLocator, calcSplices, getChangeRecords} from 'aurelia-binding';
import {BoundViewFactory, ViewSlot, customAttribute, bindable, templateController} from 'aurelia-templating';
import {ScrollHandler} from './scroll-handler';

@customAttribute('virtual-repeat')
@bindable('items')
@bindable('local')
@templateController
@inject(Element, BoundViewFactory, ViewSlot, ObserverLocator, ScrollHandler)
export class VirtualRepeat {
  constructor(element, viewFactory, viewSlot, observerLocator, scrollHandler){
    this.element = element;
    this.viewFactory = viewFactory;
    this.viewSlot = viewSlot;
    this.observerLocator = observerLocator;
    this.scrollHandler = scrollHandler;
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
    this.virtualScrollInner = this.element.parentElement;
    this.virtualScroll = this.virtualScrollInner.parentElement;
    this.virtualScroll.style.overflow = 'hidden';
    this.virtualScroll.tabIndex = '999';

    this.virtualScroll.addEventListener('touchmove', function(e) { e.preventDefault(); });

    this.scrollHandler.initialize(this.virtualScroll,  deltaY => {
      this.targetY += deltaY;
      this.targetY = Math.max(-this.scrollViewHeight, this.targetY);
      this.targetY = Math.min(0, this.targetY);
      return this.targetY;
    });

    window.onresize = () => {
      this.handleContainerResize();
    };

    // create first item to get the heights
    var row = this.createFullExecutionContext(this.items[0], 0, 1);
    var view = this.viewFactory.create(row);
    this.viewSlot.add(view);
  }

  unbind(){
    this.scrollHandler.dispose();
  }

  attached(){
    var items = this.items,
        observer, row, view;

    this.listItems = this.virtualScrollInner.children;
    this.itemHeight = VirtualRepeat.calcOuterHeight(this.listItems[0]);
    this.virtualScrollHeight = VirtualRepeat.calcScrollHeight(this.virtualScroll);
    this.numberOfDomElements = Math.ceil(this.virtualScrollHeight / this.itemHeight) + 1;

    for(var i = 1, ii = this.numberOfDomElements; i < ii; ++i){
      row = this.createFullExecutionContext(this.items[i], i, ii);
      view = this.viewFactory.create(row);
      this.viewSlot.add(view);
    }

    this.calcScrollViewHeight();

    observer = this.observerLocator.getArrayObserver(items);

    // very temp for debugging
    for(i = 0, ii = this.virtualScrollInner.children.length; i < ii; ++i){
      var node = this.virtualScrollInner.children[i];
      node.className = node.className + ' ' + i;
    }

    this.disposeSubscription = observer.subscribe(splices => {
      this.handleSplices(items, splices);
    });

    this.scroll();
  }

  handleContainerResize(){
    var children = this.viewSlot.children,
        childrenLength = children.length,
        row, view, addIndex;

    this.virtualScrollHeight = VirtualRepeat.calcScrollHeight(this.virtualScroll);
    this.numberOfDomElements = Math.ceil(this.virtualScrollHeight / this.itemHeight) + 1;

    if(this.numberOfDomElements > childrenLength){
      addIndex = children[childrenLength - 1].executionContext.$index + 1;
      row = this.createFullExecutionContext(this.items[addIndex], addIndex, this.items.length);
      view = this.viewFactory.create(row);
      this.viewSlot.insert(childrenLength, view);
    }else if (this.numberOfDomElements < childrenLength){
      this.numberOfDomElements = childrenLength;
    }

    this.calcScrollViewHeight();
  }

  scroll() {
    var scrollView = this.virtualScrollInner,
      childNodes = scrollView.childNodes,
      itemHeight = this.itemHeight,
      items = this.items,
      viewSlot = this.viewSlot,
      numberOfDomElements =  this.numberOfDomElements,
      element, viewStart, viewEnd, marginTop, translateStyle, view, first, childNodesLength;

    this.currentY += (this.targetY - this.currentY) * this.ease;
    this.currentY = Math.round(this.currentY);

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

      viewStart = VirtualRepeat.getNthNode(childNodes, 1, 8);
      element = VirtualRepeat.getNthNode(childNodes, 1, 1);
      viewEnd = VirtualRepeat.getNthNode(childNodes, 2, 8);

      scrollView.insertBefore(viewEnd, scrollView.children[numberOfDomElements]);
      scrollView.insertBefore(element, viewEnd);
      scrollView.insertBefore(viewStart, element);

      marginTop = itemHeight * first + "px";
      scrollView.style.marginTop = marginTop;

    }else if (first < this.previousFirst){
      this.previousFirst = first;

      view = viewSlot.children[numberOfDomElements - 1];
      view.executionContext[this.local] = items[first];
      view.executionContext = this.updateExecutionContext(view.executionContext, first, items.length);
      viewSlot.children.unshift(viewSlot.children.splice(-1,1)[0]);

      viewStart = VirtualRepeat.getNthNode(childNodes, 1, 8, true);
      element = VirtualRepeat.getNthNode(childNodes, 2, 1, true);
      viewEnd = VirtualRepeat.getNthNode(childNodes, 2, 8, true);

      scrollView.insertBefore(viewEnd, scrollView.childNodes[1]);
      scrollView.insertBefore(element, viewEnd);
      scrollView.insertBefore(viewStart, element);

      marginTop = itemHeight * first + "px";
      scrollView.style.marginTop = marginTop;
    }

    translateStyle = "translate3d(0px," + this.currentY + "px,0px)";

    this.virtualScrollInner.style.webkitTransform = translateStyle;
    this.virtualScrollInner.style.msTransform = translateStyle;
    this.virtualScrollInner.style.transform = translateStyle;

    requestAnimationFrame(() => this.scroll());
  }

  static getNthNode(nodes, n, nodeType, fromBottom) {
    var foundCount = 0, i = 0, found, node, lastIndex;

    lastIndex = nodes.length - 1;

    if(fromBottom){ i = lastIndex; }

    do{
      node = nodes[i];
      if(node.nodeType === nodeType){
        ++foundCount;
        if(foundCount === n){
          found = true;
        }
      }
      if(fromBottom){ --i; }else{ ++i; }
    } while(!found || i === lastIndex || i === 0);

    return node;
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
      view, i, ii, j, marginTop, addIndex, splice, end, atBottom;
    this.items = items;

    for(i = 0, ii = viewSlot.children.length; i < ii; ++i){
      view = viewSlot.children[i];
      view.executionContext[this.local] = items[this.first + i];
      view.executionContext = this.updateExecutionContext(view.executionContext, this.first + i, items.length);
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
    this.scrollViewHeight = (this.items.length * this.itemHeight) - this.virtualScrollHeight;
  }

  static getStyleValue(element, style){
    var currentStyle, styleValue;
    currentStyle = element.currentStyle || window.getComputedStyle(element);
    styleValue = parseInt(currentStyle[style]);
    return Number.isNaN(styleValue) ? 0 : styleValue;
  }

  static calcOuterHeight(element){
    var height;
    height = element.getBoundingClientRect().height;
    height += VirtualRepeat.getStyleValue(element, 'marginTop');
    height += VirtualRepeat.getStyleValue(element, 'marginBottom');
    return height;
  }

  static calcScrollHeight(element){
    var height;
    height = element.getBoundingClientRect().height;
    height -= VirtualRepeat.getStyleValue(element, 'borderTopWidth');
    height -= VirtualRepeat.getStyleValue(element, 'borderBottomWidth');
    return height;
  }

}
