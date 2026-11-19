 module . exports =
( function ( modules ) {
var installedModules = { } ;
function __webpack_require__ ( moduleId ) {
if ( installedModules [ moduleId ] ) {
return installedModules [ moduleId ] . exports ;
}
var module = installedModules [ moduleId ] = {
i : moduleId ,
l : false ,
exports : { }
} ;
modules [ moduleId ] . call ( module . exports , module , module . exports , __webpack_require__ ) ;
module . l = true ;
return module . exports ;
}
__webpack_require__ . m = modules ;
__webpack_require__ . c = installedModules ;
__webpack_require__ . d = function ( exports , name , getter ) {
if ( ! __webpack_require__ . o ( exports , name ) ) {
Object . defineProperty ( exports , name , { enumerable : true , get : getter } ) ;
}
} ;
__webpack_require__ . r = function ( exports ) {
if ( typeof Symbol !== 'undefined' && Symbol . toStringTag ) {
Object . defineProperty ( exports , Symbol . toStringTag , { value : 'Module' } ) ;
}
Object . defineProperty ( exports , '__esModule' , { value : true } ) ;
} ;
__webpack_require__ . t = function ( value , mode ) {
if ( mode & 1 ) value = __webpack_require__ ( value ) ;
if ( mode & 8 ) return value ;
if ( ( mode & 4 ) && typeof value === 'object' && value && value . __esModule ) return value ;
var ns = Object . create ( null ) ;
__webpack_require__ . r ( ns ) ;
Object . defineProperty ( ns , 'default' , { enumerable : true , value : value } ) ;
if ( mode & 2 && typeof value != 'string' ) for ( var key in value ) __webpack_require__ . d ( ns , key , function ( key ) { return value [ key ] ; } . bind ( null , key ) ) ;
return ns ;
} ;
__webpack_require__ . n = function ( module ) {
var getter = module && module . __esModule ?
function getDefault ( ) { return module [ 'default' ] ; } :
function getModuleExports ( ) { return module ; } ;
__webpack_require__ . d ( getter , 'a' , getter ) ;
return getter ;
} ;
__webpack_require__ . o = function ( object , property ) { return Object . prototype . hasOwnProperty . call ( object , property ) ; } ;
__webpack_require__ . p = "" ;
return __webpack_require__ ( __webpack_require__ . s = 0 ) ;
} )
( [
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "EE" , function ( ) { return EE ; } ) ;
var _env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 1 ) ;
var _env_js__WEBPACK_IMPORTED_MODULE_0___default = __webpack_require__ . n ( _env_js__WEBPACK_IMPORTED_MODULE_0__ ) ;
var _components_elements_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 2 ) ;
var _common_pool_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__ ( 6 ) ;
var tiny_emitter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__ ( 8 ) ;
var tiny_emitter__WEBPACK_IMPORTED_MODULE_3___default = __webpack_require__ . n ( tiny_emitter__WEBPACK_IMPORTED_MODULE_3__ ) ;
var css_layout__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__ ( 9 ) ;
var css_layout__WEBPACK_IMPORTED_MODULE_4___default = __webpack_require__ . n ( css_layout__WEBPACK_IMPORTED_MODULE_4__ ) ;
var _common_util_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__ ( 7 ) ;
var _libs_fast_xml_parser_parser_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__ ( 10 ) ;
var _libs_fast_xml_parser_parser_js__WEBPACK_IMPORTED_MODULE_6___default = __webpack_require__ . n ( _libs_fast_xml_parser_parser_js__WEBPACK_IMPORTED_MODULE_6__ ) ;
var _common_bitMapFont__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__ ( 16 ) ;
var _common_debugInfo_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__ ( 17 ) ;
var _common_ticker__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__ ( 18 ) ;
var _common_vd__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__ ( 19 ) ;
var _common_imageManager_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__ ( 5 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var EE = new tiny_emitter__WEBPACK_IMPORTED_MODULE_3___default . a ( ) ;
var imgPool = new _common_pool_js__WEBPACK_IMPORTED_MODULE_2__ [ "default" ] ( 'imgPool' ) ;
var debugInfo = new _common_debugInfo_js__WEBPACK_IMPORTED_MODULE_8__ [ "default" ] ( ) ;
var Layout = function ( _Element ) {
_inherits ( Layout , _Element ) ;
var _super = _createSuper ( Layout ) ;
function Layout ( ) {
var _this ;
var _ref = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : { } ,
style = _ref . style ,
name = _ref . name ;
_classCallCheck ( this , Layout ) ;
_this = _super . call ( this , {
style : style ,
id : 0 ,
name : name
} ) ;
_this . hasEventHandler = false ;
_this . elementTree = null ;
_this . renderContext = null ;
_this . renderport = { } ;
_this . viewport = { } ;
_this . viewportScale = 1 ;
_this . hasViewPortSet = false ;
_this . realLayoutBox = {
realX : 0 ,
realY : 0
} ;
_this . touchMsg = { } ;
_this . touchStart = _this . eventHandler ( 'touchstart' ) . bind ( _assertThisInitialized ( _this ) ) ;
_this . touchMove = _this . eventHandler ( 'touchmove' ) . bind ( _assertThisInitialized ( _this ) ) ;
_this . touchEnd = _this . eventHandler ( 'touchend' ) . bind ( _assertThisInitialized ( _this ) ) ;
_this . touchCancel = _this . eventHandler ( 'touchcancel' ) . bind ( _assertThisInitialized ( _this ) ) ;
_this . version = '1.0.1' ;
_this . eleCount = 0 ;
_this . state = _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "STATE" ] . UNINIT ;
_this . bitMapFonts = [ ] ;
_this . isNeedRepaint = false ;
_this . on ( 'repaint' , function ( ) {
_this . isNeedRepaint = true ;
} ) ;
_this . ticker = new _common_ticker__WEBPACK_IMPORTED_MODULE_9__ [ "default" ] ( ) ;
_this . tickerFunc = function ( ) {
if ( _this . isDirty ) {
_this . reflow ( ) ;
} else if ( _this . isNeedRepaint ) {
_this . repaint ( ) ;
}
} ;
console . log ( "[Layout] v" . concat ( _this . version ) ) ;
return _this ;
}
_createClass ( Layout , [ {
key : "debugInfo" ,
get : function get ( ) {
var info = debugInfo . log ( ) ;
info += "elementCount: " . concat ( this . eleCount , "\n" ) ;
return info ;
}
} , {
key : "updateViewPort" ,
value : function updateViewPort ( box ) {
this . viewport . width = box . width || 0 ;
this . viewport . height = box . height || 0 ;
this . viewport . x = box . x || 0 ;
this . viewport . y = box . y || 0 ;
this . realLayoutBox = {
realX : this . viewport . x ,
realY : this . viewport . y
} ;
this . hasViewPortSet = true ;
}
} , {
key : "init" ,
value : function init ( template , style , attrValueProcessor ) {
debugInfo . start ( 'init' ) ;
var parseConfig = {
attributeNamePrefix : '' ,
attrNodeName : 'attr' ,
textNodeName : '#text' ,
ignoreAttributes : false ,
ignoreNameSpace : true ,
allowBooleanAttributes : true ,
parseNodeValue : false ,
parseAttributeValue : false ,
trimValues : true ,
parseTrueNumberOnly : false
} ;
if ( attrValueProcessor && typeof attrValueProcessor === 'function' ) {
parseConfig . attrValueProcessor = attrValueProcessor ;
}
debugInfo . start ( 'init_xmlParse' ) ;
var jsonObj = _libs_fast_xml_parser_parser_js__WEBPACK_IMPORTED_MODULE_6___default . a . parse ( template , parseConfig , true ) ;
debugInfo . end ( 'init_xmlParse' ) ;
var xmlTree = jsonObj . children [ 0 ] ;
debugInfo . start ( 'init_xml2Layout' ) ;
var layoutTree = _common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "create" ] . call ( this , xmlTree , style ) ;
debugInfo . end ( 'init_xml2Layout' ) ;
this . add ( layoutTree ) ;
this . state = _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "STATE" ] . INITED ;
this . ticker . add ( this . tickerFunc , true ) ;
this . ticker . start ( ) ;
debugInfo . end ( 'init' ) ;
}
} , {
key : "reflow" ,
value : function reflow ( ) {
var isFirst = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : false ;
if ( ! isFirst ) {
debugInfo . reset ( ) ;
}
debugInfo . start ( 'layout_reflow' ) ;
debugInfo . start ( 'computeLayout' , true ) ;
css_layout__WEBPACK_IMPORTED_MODULE_4___default ( ) ( this . children [ 0 ] ) ;
debugInfo . end ( 'computeLayout' ) ;
var rootEle = this . children [ 0 ] ;
if ( rootEle . style . width === undefined || rootEle . style . height === undefined ) {
console . error ( '[Layout] Please set width and height property for root element' ) ;
} else {
this . renderport . width = rootEle . style . width ;
this . renderport . height = rootEle . style . height ;
}
debugInfo . start ( 'layoutChildren' , true ) ;
_common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "layoutChildren" ] . call ( this , this ) ;
debugInfo . end ( 'layoutChildren' ) ;
this . viewportScale = this . viewport . width / this . renderport . width ;
Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "clearCanvas" ] ) ( this . renderContext ) ;
debugInfo . start ( 'renderChildren' , true ) ;
Object ( _common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "renderChildren" ] ) ( this . children , this . renderContext , false ) ;
debugInfo . end ( 'renderChildren' ) ;
debugInfo . start ( 'repaint' , true ) ;
this . repaint ( ) ;
debugInfo . end ( 'repaint' ) ;
this . isDirty = false ;
debugInfo . end ( 'layout_reflow' ) ;
}
} , {
key : "layout" ,
value : function layout ( context ) {
this . renderContext = context ;
if ( ! this . hasViewPortSet ) {
console . error ( 'Please invoke method `updateViewPort` before method `layout`' ) ;
}
debugInfo . start ( 'layout' ) ;
this . reflow ( true ) ;
debugInfo . start ( 'layout_other' ) ;
this . bindEvents ( ) ;
debugInfo . start ( 'observeStyleAndEvent' , true ) ;
Object ( _common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "iterateTree" ] ) ( this . children [ 0 ] , function ( element ) {
return element . observeStyleAndEvent ( ) ;
} ) ;
debugInfo . end ( 'layout_observeStyleAndEvent' ) ;
this . state = _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "STATE" ] . RENDERED ;
debugInfo . end ( 'layout' ) ;
debugInfo . end ( 'layout_other' ) ;
}
} , {
key : "repaint" ,
value : function repaint ( ) {
Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "clearCanvas" ] ) ( this . renderContext ) ;
this . isNeedRepaint = false ;
Object ( _common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "repaintChildren" ] ) ( this . children ) ;
}
} , {
key : "getChildByPos" ,
value : function getChildByPos ( tree , x , y , itemList ) {
var _this2 = this ;
tree . children . forEach ( function ( ele ) {
var _ele$layoutBox = ele . layoutBox ,
absoluteX = _ele$layoutBox . absoluteX ,
absoluteY = _ele$layoutBox . absoluteY ,
width = _ele$layoutBox . width ,
height = _ele$layoutBox . height ;
var realX = absoluteX * _this2 . viewportScale + _this2 . realLayoutBox . realX ;
var realY = absoluteY * _this2 . viewportScale + _this2 . realLayoutBox . realY ;
var realWidth = width * _this2 . viewportScale ;
var realHeight = height * _this2 . viewportScale ;
if ( realX <= x && x <= realX + realWidth && realY <= y && y <= realY + realHeight ) {
itemList . push ( ele ) ;
if ( ele . children . length ) {
_this2 . getChildByPos ( ele , x , y , itemList ) ;
}
}
} ) ;
}
} , {
key : "eventHandler" ,
value : function eventHandler ( eventName ) {
return function touchEventHandler ( e ) {
var touch = e . touches && e . touches [ 0 ] || e . changedTouches && e . changedTouches [ 0 ] || e ;
if ( ! touch || ! touch . pageX || ! touch . pageY ) {
return ;
}
if ( ! touch . timeStamp ) {
touch . timeStamp = e . timeStamp ;
}
var list = [ ] ;
if ( touch ) {
this . getChildByPos ( this , touch . pageX , touch . pageY , list ) ;
}
if ( ! list . length ) {
list . push ( this ) ;
}
var item = list [ list . length - 1 ] ;
item && item . emit ( eventName , e ) ;
if ( eventName === 'touchstart' || eventName === 'touchend' ) {
this . touchMsg [ eventName ] = touch ;
}
if ( eventName === 'touchend' && Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "isClick" ] ) ( this . touchMsg ) ) {
item && item . emit ( 'click' , e ) ;
}
} ;
}
} , {
key : "bindEvents" ,
value : function bindEvents ( ) {
if ( this . hasEventHandler ) {
return ;
}
this . hasEventHandler = true ;
if ( typeof __env !== 'undefined' ) {
__env . onTouchStart ( this . touchStart ) ;
__env . onTouchMove ( this . touchMove ) ;
__env . onTouchEnd ( this . touchEnd ) ;
__env . onTouchCancel ( this . touchCancel ) ;
} else {
document . onmousedown = this . touchStart ;
document . onmousemove = this . touchMove ;
document . onmouseup = this . touchEnd ;
document . onmouseleave = this . touchEnd ;
}
}
} , {
key : "unBindEvents" ,
value : function unBindEvents ( ) {
if ( typeof __env !== 'undefined' ) {
__env . offTouchStart ( this . touchStart ) ;
__env . offTouchMove ( this . touchMove ) ;
__env . offTouchEnd ( this . touchEnd ) ;
__env . offTouchCancel ( this . touchCancel ) ;
} else {
document . onmousedown = null ;
document . onmousemove = null ;
document . onmouseup = null ;
document . onmouseleave = null ;
}
this . hasEventHandler = false ;
}
} , {
key : "emit" ,
value : function emit ( event , data ) {
EE . emit ( event , data ) ;
}
} , {
key : "on" ,
value : function on ( event , callback ) {
EE . on ( event , callback ) ;
}
} , {
key : "once" ,
value : function once ( event , callback ) {
EE . once ( event , callback ) ;
}
} , {
key : "off" ,
value : function off ( event , callback ) {
EE . off ( event , callback ) ;
}
} , {
key : "destroyAll" ,
value : function destroyAll ( tree ) {
var _this3 = this ;
var children = tree . children ;
children . forEach ( function ( child ) {
child . destroy ( ) ;
_this3 . destroyAll ( child ) ;
child . destroySelf && child . destroySelf ( ) ;
} ) ;
}
} , {
key : "clear" ,
value : function clear ( ) {
var options = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : { } ;
var _options$removeTicker = options . removeTicker ,
removeTicker = _options$removeTicker === void 0 ? true : _options$removeTicker ;
debugInfo . reset ( ) ;
this . destroyAll ( this ) ;
this . elementTree = null ;
this . children = [ ] ;
this . state = _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "STATE" ] . CLEAR ;
this . isDirty = false ;
Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_5__ [ "clearCanvas" ] ) ( this . renderContext ) ;
this . eleCount = 0 ;
this . unBindEvents ( ) ;
if ( removeTicker ) {
this . ticker . remove ( ) ;
this . ticker . stop ( ) ;
}
}
} , {
key : "clearPool" ,
value : function clearPool ( ) {
imgPool . clear ( ) ;
}
} , {
key : "clearAll" ,
value : function clearAll ( ) {
this . clear ( ) ;
this . clearPool ( ) ;
}
} , {
key : "loadImgs" ,
value : function loadImgs ( ) {
var arr = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : [ ] ;
return Promise . all ( arr . map ( function ( src ) {
return _common_imageManager_js__WEBPACK_IMPORTED_MODULE_11__ [ "default" ] . loadImagePromise ( src ) ;
} ) ) ;
}
} , {
key : "registBitMapFont" ,
value : function registBitMapFont ( name , src , config ) {
var font = new _common_bitMapFont__WEBPACK_IMPORTED_MODULE_7__ [ "default" ] ( name , src , config ) ;
this . bitMapFonts . push ( font ) ;
}
} , {
key : "cloneNode" ,
value : function cloneNode ( element ) {
var deep = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : true ;
return _common_vd__WEBPACK_IMPORTED_MODULE_10__ [ "clone" ] . call ( this , element , deep ) ;
}
} ] ) ;
return Layout ;
} ( _components_elements_js__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ) ;
__webpack_exports__ [ "default" ] = ( new Layout ( {
style : {
width : 0 ,
height : 0
} ,
name : 'layout'
} ) ) ;
} ) ,
( function ( module , exports ) {
if ( typeof GameGlobal !== 'undefined' ) {
GameGlobal . __env = GameGlobal . wx || GameGlobal . tt || GameGlobal . swan ;
}
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "getElementsById" , function ( ) { return _getElementsById ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "getElementsByClassName" , function ( ) { return _getElementsByClassName ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Element ; } ) ;
var _style_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 3 ) ;
var _common_rect__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 4 ) ;
var _common_imageManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__ ( 5 ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _getElementsById ( tree ) {
var list = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : [ ] ;
var id = arguments . length > 2 ? arguments [ 2 ] : undefined ;
Object . keys ( tree . children ) . forEach ( function ( key ) {
var child = tree . children [ key ] ;
if ( child . idName === id ) {
list . push ( child ) ;
}
if ( Object . keys ( child . children ) . length ) {
_getElementsById ( child , list , id ) ;
}
} ) ;
return list ;
}
function _getElementsByClassName ( tree ) {
var list = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : [ ] ;
var className = arguments . length > 2 ? arguments [ 2 ] : undefined ;
Object . keys ( tree . children ) . forEach ( function ( key ) {
var child = tree . children [ key ] ;
if ( ( child . classNameList || child . className . split ( /\s+/ ) ) . indexOf ( className ) > - 1 ) {
list . push ( child ) ;
}
if ( Object . keys ( child . children ) . length ) {
_getElementsByClassName ( child , list , className ) ;
}
} ) ;
return list ;
}
var Emitter = __webpack_require__ ( 8 ) ;
var EE = new Emitter ( ) ;
var uuid = 0 ;
function hexToRgb ( hex ) {
var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i . exec ( hex ) ;
return result ? {
r : parseInt ( result [ 1 ] , 16 ) ,
g : parseInt ( result [ 2 ] , 16 ) ,
b : parseInt ( result [ 3 ] , 16 )
} : null ;
}
function getRgba ( hex , opacity ) {
var rgbObj = hexToRgb ( hex ) ;
if ( opacity === undefined ) {
opacity = 1 ;
}
return "rgba(" . concat ( rgbObj . r , ", " ) . concat ( rgbObj . g , ", " ) . concat ( rgbObj . b , ", " ) . concat ( opacity , ")" ) ;
}
var toEventName = function toEventName ( event , id ) {
var elementEvent = [ 'click' , 'touchstart' , 'touchmove' , 'touchend' , 'touchcancel' ] ;
if ( elementEvent . indexOf ( event ) !== - 1 ) {
return "element-" . concat ( id , "-" ) . concat ( event ) ;
}
return "element-" . concat ( id , "-" ) . concat ( event ) ;
} ;
var isValidUrlPropReg = /\s*url\((.*?)\)\s*/ ;
var Element = function ( ) {
function Element ( _ref ) {
var _ref$style = _ref . style ,
style = _ref$style === void 0 ? { } : _ref$style ,
_ref$idName = _ref . idName ,
idName = _ref$idName === void 0 ? '' : _ref$idName ,
_ref$className = _ref . className ,
className = _ref$className === void 0 ? '' : _ref$className ,
_ref$id = _ref . id ,
id = _ref$id === void 0 ? uuid += 1 : _ref$id ,
_ref$dataset = _ref . dataset ,
dataset = _ref$dataset === void 0 ? { } : _ref$dataset ;
_classCallCheck ( this , Element ) ;
this . children = [ ] ;
this . parent = null ;
this . parentId = 0 ;
this . id = id ;
this . idName = idName ;
this . className = className ;
this . EE = EE ;
this . root = null ;
this . isDestroyed = false ;
this . layoutBox = { } ;
this . dataset = dataset ;
if ( style . opacity !== undefined && style . color && style . color . indexOf ( '#' ) > - 1 ) {
style . color = getRgba ( style . color , style . opacity ) ;
}
if ( style . opacity !== undefined && style . backgroundColor && style . backgroundColor . indexOf ( '#' ) > - 1 ) {
style . backgroundColor = getRgba ( style . backgroundColor , style . opacity ) ;
}
if ( typeof style . backgroundImage === 'string' ) {
this . backgroundImageSetHandler ( style . backgroundImage ) ;
}
this . originStyle = style ;
this . style = style ;
this . rect = null ;
this . viewportRect = null ;
this . classNameList = null ;
}
_createClass ( Element , [ {
key : "backgroundImageSetHandler" ,
value : function backgroundImageSetHandler ( backgroundImage ) {
var _this = this ;
if ( typeof backgroundImage === 'string' ) {
var list = backgroundImage . match ( isValidUrlPropReg ) ;
if ( list ) {
var url = list [ 1 ] . replace ( /('|")/g , '' ) ;
_common_imageManager__WEBPACK_IMPORTED_MODULE_2__ [ "default" ] . loadImage ( url , function ( img ) {
if ( ! _this . isDestroyed ) {
_this . backgroundImage = img ;
_this . root && _this . root . emit ( 'repaint' ) ;
}
} ) ;
} else {
console . error ( "[Layout]: " . concat ( backgroundImage , " is not a valid backgroundImage" ) ) ;
}
}
}
} , {
key : "observeStyleAndEvent" ,
value : function observeStyleAndEvent ( ) {
var _this2 = this ;
if ( typeof Proxy === 'function' ) {
var ele = this ;
this . style = new Proxy ( this . originStyle , {
get : function get ( target , prop , receiver ) {
return Reflect . get ( target , prop , receiver ) ;
} ,
set : function set ( target , prop , val , receiver ) {
if ( _style_js__WEBPACK_IMPORTED_MODULE_0__ [ "reflowAffectedStyles" ] . indexOf ( prop ) > - 1 ) {
ele . isDirty = true ;
var parent = ele . parent ;
while ( parent ) {
parent . isDirty = true ;
parent = parent . parent ;
}
} else if ( _style_js__WEBPACK_IMPORTED_MODULE_0__ [ "repaintAffectedStyles" ] . indexOf ( prop ) > - 1 ) {
ele . root . emit ( 'repaint' ) ;
} else if ( prop === 'backgroundImage' ) {
ele . backgroundImageSetHandler ( val ) ;
}
return Reflect . set ( target , prop , val , receiver ) ;
}
} ) ;
} else {
var innerStyle = Object . assign ( { } , this . style ) ;
_style_js__WEBPACK_IMPORTED_MODULE_0__ [ "allStyles" ] . forEach ( function ( key ) {
Object . defineProperty ( _this2 . style , key , {
configurable : true ,
enumerable : true ,
get : function get ( ) {
return innerStyle [ key ] ;
} ,
set : function set ( value ) {
innerStyle [ key ] = value ;
if ( _style_js__WEBPACK_IMPORTED_MODULE_0__ [ "reflowAffectedStyles" ] . indexOf ( key ) > - 1 ) {
_this2 . isDirty = true ;
var parent = _this2 . parent ;
while ( parent ) {
parent . isDirty = true ;
parent = parent . parent ;
}
} else if ( _style_js__WEBPACK_IMPORTED_MODULE_0__ [ "repaintAffectedStyles" ] . indexOf ( key ) > - 1 ) {
_this2 . root . emit ( 'repaint' ) ;
} else if ( key === 'backgroundImage' ) {
_this2 . backgroundImageSetHandler ( value ) ;
}
}
} ) ;
} ) ;
}
[ 'touchstart' , 'touchmove' , 'touchcancel' , 'touchend' , 'click' ] . forEach ( function ( eventName ) {
_this2 . on ( eventName , function ( e , touchMsg ) {
_this2 . parent && _this2 . parent . emit ( eventName , e , touchMsg ) ;
} ) ;
} ) ;
this . classNameList = this . className . split ( /\s+/ ) ;
}
} , {
key : "repaint" ,
value : function repaint ( ) { }
} , {
key : "render" ,
value : function render ( ) { }
} , {
key : "getBoundingClientRect" ,
value : function getBoundingClientRect ( ) {
if ( ! this . rect ) {
this . rect = new _common_rect__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ( this . layoutBox . absoluteX , this . layoutBox . absoluteY , this . layoutBox . width , this . layoutBox . height ) ;
}
this . rect . set ( this . layoutBox . absoluteX , this . layoutBox . absoluteY , this . layoutBox . width , this . layoutBox . height ) ;
return this . rect ;
}
} , {
key : "getViewportRect" ,
value : function getViewportRect ( ) {
var realLayoutBox = this . root . realLayoutBox ;
var viewportScale = this . root . viewportScale ;
var _this$layoutBox = this . layoutBox ,
absoluteX = _this$layoutBox . absoluteX ,
absoluteY = _this$layoutBox . absoluteY ,
width = _this$layoutBox . width ,
height = _this$layoutBox . height ;
var realX = absoluteX * viewportScale + realLayoutBox . realX ;
var realY = absoluteY * viewportScale + realLayoutBox . realY ;
var realWidth = width * viewportScale ;
var realHeight = height * viewportScale ;
if ( ! this . viewportRect ) {
this . viewportRect = new _common_rect__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ( realX , realY , realWidth , realHeight ) ;
}
this . viewportRect . set ( realX , realY , realWidth , realHeight ) ;
return this . viewportRect ;
}
} , {
key : "getElementsById" ,
value : function getElementsById ( id ) {
return _getElementsById ( this , [ ] , id ) ;
}
} , {
key : "getElementsByClassName" ,
value : function getElementsByClassName ( className ) {
return _getElementsByClassName ( this , [ ] , className ) ;
}
} , {
key : "insert" ,
value : function insert ( ctx , needRender ) {
this . ctx = ctx ;
if ( needRender ) {
this . render ( ) ;
}
}
} , {
key : "unBindEvent" ,
value : function unBindEvent ( ) {
var _this3 = this ;
[ 'touchstart' , 'touchmove' , 'touchcancel' , 'touchend' , 'click' , 'repaint' ] . forEach ( function ( eventName ) {
_this3 . off ( eventName ) ;
} ) ;
}
} , {
key : "setDirty" ,
value : function setDirty ( ) {
this . isDirty = true ;
var parent = this . parent ;
while ( parent ) {
parent . isDirty = true ;
parent = parent . parent ;
}
}
} , {
key : "remove" ,
value : function remove ( ) {
var parent = this . parent ;
var index = parent . children . indexOf ( this ) ;
if ( index !== - 1 ) {
parent . children . splice ( index , 1 ) ;
this . unBindEvent ( ) ;
this . setDirty ( ) ;
this . parent = null ;
this . ctx = null ;
} else {
console . warn ( '[Layout] this element has been removed' ) ;
}
}
} , {
key : "destroy" ,
value : function destroy ( ) {
this . unBindEvent ( ) ;
this . isDestroyed = true ;
this . EE = null ;
this . parent = null ;
this . ctx = null ;
this . layoutBox = null ;
this . style = null ;
this . className = '' ;
this . classNameList = null ;
}
} , {
key : "add" ,
value : function add ( element ) {
element . parent = this ;
element . parentId = this . id ;
this . children . push ( element ) ;
}
} , {
key : "appendChild" ,
value : function appendChild ( element ) {
this . add ( element ) ;
this . setDirty ( ) ;
}
} , {
key : "removeChild" ,
value : function removeChild ( element ) {
var index = this . children . indexOf ( element ) ;
if ( index !== - 1 ) {
element . remove ( ) ;
this . setDirty ( ) ;
} else {
console . warn ( '[Layout] the element to be removed is not a child of this element' ) ;
}
}
} , {
key : "emit" ,
value : function emit ( event ) {
for ( var _len = arguments . length , theArgs = new Array ( _len > 1 ? _len - 1 : 0 ) , _key = 1 ; _key < _len ; _key ++ ) {
theArgs [ _key - 1 ] = arguments [ _key ] ;
}
EE . emit . apply ( EE , [ toEventName ( event , this . id ) ] . concat ( theArgs ) ) ;
}
} , {
key : "on" ,
value : function on ( event , callback ) {
EE . on ( toEventName ( event , this . id ) , callback ) ;
}
} , {
key : "once" ,
value : function once ( event , callback ) {
EE . once ( toEventName ( event , this . id ) , callback ) ;
}
} , {
key : "off" ,
value : function off ( event , callback ) {
EE . off ( toEventName ( event , this . id ) , callback ) ;
}
} , {
key : "renderBorder" ,
value : function renderBorder ( ctx ) {
var style = this . style || { } ;
var radius = style . borderRadius || 0 ;
var _style$borderWidth = style . borderWidth ,
borderWidth = _style$borderWidth === void 0 ? 0 : _style$borderWidth ;
var borderTopLeftRadius = style . borderTopLeftRadius || radius ;
var borderTopRightRadius = style . borderTopRightRadius || radius ;
var borderBottomLeftRadius = style . borderBottomLeftRadius || radius ;
var borderBottomRightRadius = style . borderBottomRightRadius || radius ;
var box = this . layoutBox ;
var borderColor = style . borderColor ;
var x = box . absoluteX ;
var y = box . absoluteY ;
var width = box . width ,
height = box . height ;
var hasRadius = radius || borderTopLeftRadius || borderTopRightRadius || borderBottomLeftRadius || borderBottomRightRadius ;
if ( ! borderWidth && ! hasRadius ) {
return {
needClip : false ,
needStroke : false
} ;
}
ctx . beginPath ( ) ;
ctx . lineWidth = borderWidth ;
ctx . strokeStyle = borderColor ;
ctx . moveTo ( x + borderTopLeftRadius , y ) ;
ctx . lineTo ( x + width - borderTopRightRadius , y ) ;
ctx . arcTo ( x + width , y , x + width , y + borderTopRightRadius , borderTopRightRadius ) ;
ctx . lineTo ( x + width , y + height - borderBottomRightRadius ) ;
ctx . arcTo ( x + width , y + height , x + width - borderBottomRightRadius , y + height , borderBottomRightRadius ) ;
ctx . lineTo ( x + borderBottomLeftRadius , y + height ) ;
ctx . arcTo ( x , y + height , x , y + height - borderBottomLeftRadius , borderBottomLeftRadius ) ;
ctx . lineTo ( x , y + borderTopLeftRadius ) ;
ctx . arcTo ( x , y , x + borderTopLeftRadius , y , borderTopLeftRadius ) ;
return {
needClip : ! ! hasRadius ,
needStroke : ! ! borderWidth
} ;
}
} ] ) ;
return Element ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "repaintAffectedStyles" , function ( ) { return repaintAffectedStyles ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "reflowAffectedStyles" , function ( ) { return reflowAffectedStyles ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "allStyles" , function ( ) { return allStyles ; } ) ;
var reflowAffectedStyles = [ 'width' , 'height' , 'minWidth' , 'minHeight' , 'maxWidth' , 'maxHeight' , 'left' , 'right' , 'top' , 'bottom' , 'margin' , 'marginLeft' , 'marginRight' , 'marginTop' , 'marginBottom' , 'padding' , 'paddingLeft' , 'paddingRight' , 'paddingTop' , 'paddingBottom' , 'borderWidth' , 'borderLeftWidth' , 'borderRightWidth' , 'borderTopWidth' , 'borderBottomWidth' , 'flexDirection' , 'justifyContent' , 'alignItems' , 'alignSelf' , 'flex' , 'flexWrap' , 'position' ] ;
var repaintAffectedStyles = [ 'fontSize' , 'lineHeight' , 'textAlign' , 'verticalAlign' , 'color' , 'backgroundColor' , 'textOverflow' , 'letterSpacing' , 'backgroundColor' , 'borderRadius' , 'borderColor' ] ;
var allStyles = reflowAffectedStyles . concat ( repaintAffectedStyles ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Rect ; } ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _defineProperty ( obj , key , value ) { if ( key in obj ) { Object . defineProperty ( obj , key , { value : value , enumerable : true , configurable : true , writable : true } ) ; } else { obj [ key ] = value ; } return obj ; }
var Rect = function ( ) {
function Rect ( ) {
var left = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : 0 ;
var top = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : 0 ;
var width = arguments . length > 2 && arguments [ 2 ] !== undefined ? arguments [ 2 ] : 0 ;
var height = arguments . length > 3 && arguments [ 3 ] !== undefined ? arguments [ 3 ] : 0 ;
_classCallCheck ( this , Rect ) ;
_defineProperty ( this , "width" , 0 ) ;
_defineProperty ( this , "height" , 0 ) ;
_defineProperty ( this , "left" , 0 ) ;
_defineProperty ( this , "right" , 0 ) ;
_defineProperty ( this , "top" , 0 ) ;
_defineProperty ( this , "bottom" , 0 ) ;
this . set ( left , top , width , height ) ;
}
_createClass ( Rect , [ {
key : "set" ,
value : function set ( ) {
var left = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : 0 ;
var top = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : 0 ;
var width = arguments . length > 2 && arguments [ 2 ] !== undefined ? arguments [ 2 ] : 0 ;
var height = arguments . length > 3 && arguments [ 3 ] !== undefined ? arguments [ 3 ] : 0 ;
this . left = left ;
this . top = top ;
this . width = width ;
this . height = height ;
this . right = this . left + this . width ;
this . bottom = this . top + this . height ;
}
} , {
key : "intersects" ,
value : function intersects ( rect ) {
return ! ( this . right < rect . left || rect . right < this . left || this . bottom < rect . top || rect . bottom < this . top ) ;
}
} ] ) ;
return Rect ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
var _pool__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 6 ) ;
var _util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 7 ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
var imgPool = new _pool__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ( 'imgPool' ) ;
var ImageManager = function ( ) {
function ImageManager ( ) {
_classCallCheck ( this , ImageManager ) ;
}
_createClass ( ImageManager , [ {
key : "getRes" ,
value : function getRes ( src ) {
return imgPool . get ( src ) ;
}
} , {
key : "loadImagePromise" ,
value : function loadImagePromise ( src ) {
var _this = this ;
return new Promise ( function ( resolve , reject ) {
_this . loadImage ( src , resolve , reject ) ;
} ) ;
}
} , {
key : "loadImage" ,
value : function loadImage ( src ) {
var callback = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : _util__WEBPACK_IMPORTED_MODULE_1__ [ "none" ] ;
var fail = arguments . length > 2 && arguments [ 2 ] !== undefined ? arguments [ 2 ] : _util__WEBPACK_IMPORTED_MODULE_1__ [ "none" ] ;
var img = null ;
var cache = this . getRes ( src ) ;
if ( ! src ) {
return img ;
}
if ( cache && cache . loadDone ) {
img = cache ;
callback ( img , true ) ;
} else if ( cache && ! cache . loadDone ) {
img = cache ;
cache . onloadcbks . push ( callback ) ;
cache . onerrorcbks . push ( fail ) ;
} else {
img = Object ( _util__WEBPACK_IMPORTED_MODULE_1__ [ "createImage" ] ) ( ) ;
img . onloadcbks = [ callback ] ;
img . onerrorcbks = [ fail ] ;
imgPool . set ( src , img ) ;
img . onload = function ( ) {
img . loadDone = true ;
img . onloadcbks . forEach ( function ( fn ) {
return fn ( img , false ) ;
} ) ;
img . onloadcbks = [ ] ;
img . onerrorcbks = [ ] ;
} ;
img . onerror = function ( ) {
img . onerrorcbks . forEach ( function ( fn ) {
return fn ( img , false ) ;
} ) ;
img . onerrorcbks = [ ] ;
img . onloadcbks = [ ] ;
} ;
img . src = src ;
}
return img ;
}
} ] ) ;
return ImageManager ;
} ( ) ;
__webpack_exports__ [ "default" ] = ( new ImageManager ( ) ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Pool ; } ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
var pools = [ ] ;
var Pool = function ( ) {
function Pool ( ) {
var name = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : 'pool' ;
_classCallCheck ( this , Pool ) ;
var curr = pools . find ( function ( item ) {
return item . name === name ;
} ) ;
if ( curr ) {
return curr ;
}
this . name = name ;
this . pool = { } ;
pools . push ( this ) ;
}
_createClass ( Pool , [ {
key : "get" ,
value : function get ( key ) {
return this . pool [ key ] ;
}
} , {
key : "set" ,
value : function set ( key , value ) {
this . pool [ key ] = value ;
}
} , {
key : "clear" ,
value : function clear ( ) {
this . pool = { } ;
}
} , {
key : "getList" ,
value : function getList ( ) {
return Object . values ( this . pool ) ;
}
} ] ) ;
return Pool ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "none" , function ( ) { return none ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "isClick" , function ( ) { return isClick ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "createCanvas" , function ( ) { return createCanvas ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "createImage" , function ( ) { return createImage ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "getDpr" , function ( ) { return getDpr ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "STATE" , function ( ) { return STATE ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "clearCanvas" , function ( ) { return clearCanvas ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "copyTouchArray" , function ( ) { return copyTouchArray ; } ) ;
function none ( ) { }
function isClick ( touchMsg ) {
var start = touchMsg . touchstart ;
var end = touchMsg . touchend ;
if ( ! start || ! end || ! start . timeStamp || ! end . timeStamp || start . pageX === undefined || start . pageY === undefined || end . pageX === undefined || end . pageY === undefined ) {
return false ;
}
var startPosX = start . pageX ;
var startPosY = start . pageY ;
var endPosX = end . pageX ;
var endPosY = end . pageY ;
var touchTimes = end . timeStamp - start . timeStamp ;
return ! ! ( Math . abs ( endPosY - startPosY ) < 30 && Math . abs ( endPosX - startPosX ) < 30 && touchTimes < 300 ) ;
}
function createCanvas ( ) {
if ( typeof __env !== 'undefined' ) {
return __env . createCanvas ( ) ;
}
return document . createElement ( 'canvas' ) ;
}
function createImage ( ) {
if ( typeof __env !== 'undefined' ) {
return __env . createImage ( ) ;
}
return document . createElement ( 'img' ) ;
}
var _dpr ;
if ( typeof swan !== 'undefined' ) {
__env . onMessage ( function ( res ) {
if ( res && res . type === 'engine' ) {
if ( res . event === 'systemInfo' ) {
_dpr = res . systemInfo . devicePixelRatio ;
}
}
} ) ;
}
function getDpr ( ) {
if ( typeof _dpr !== 'undefined' ) {
return _dpr ;
}
if ( typeof __env !== 'undefined' && __env . getSystemInfoSync ) {
_dpr = __env . getSystemInfoSync ( ) . devicePixelRatio ;
} else if ( window . devicePixelRatio ) {
_dpr = window . devicePixelRatio ;
} else {
console . warn ( '[Layout] failed to access device pixel ratio, fallback to 1' ) ;
_dpr = 1 ;
}
return _dpr ;
}
var STATE = {
UNINIT : 'UNINIT' ,
INITED : 'INITED' ,
RENDERED : 'RENDERED' ,
CLEAR : 'CLEAR'
} ;
function clearCanvas ( ctx ) {
ctx && ctx . clearRect ( 0 , 0 , ctx . canvas . width , ctx . canvas . height ) ;
}
function copyTouchArray ( touches ) {
return touches . map ( function ( touch ) {
return {
identifier : touch . identifier ,
pageX : touch . pageX ,
pageY : touch . pageY ,
clientX : touch . clientX ,
clientY : touch . clientY
} ;
} ) ;
}
} ) ,
( function ( module , exports ) {
function E ( ) {
}
E . prototype = {
on : function ( name , callback , ctx ) {
var e = this . e || ( this . e = { } ) ;
( e [ name ] || ( e [ name ] = [ ] ) ) . push ( {
fn : callback ,
ctx : ctx
} ) ;
return this ;
} ,
once : function ( name , callback , ctx ) {
var self = this ;
function listener ( ) {
self . off ( name , listener ) ;
callback . apply ( ctx , arguments ) ;
} ;
listener . _ = callback
return this . on ( name , listener , ctx ) ;
} ,
emit : function ( name ) {
var data = [ ] . slice . call ( arguments , 1 ) ;
var evtArr = ( ( this . e || ( this . e = { } ) ) [ name ] || [ ] ) . slice ( ) ;
var i = 0 ;
var len = evtArr . length ;
for ( i ; i < len ; i ++ ) {
evtArr [ i ] . fn . apply ( evtArr [ i ] . ctx , data ) ;
}
return this ;
} ,
off : function ( name , callback ) {
var e = this . e || ( this . e = { } ) ;
var evts = e [ name ] ;
var liveEvents = [ ] ;
if ( evts && callback ) {
for ( var i = 0 , len = evts . length ; i < len ; i ++ ) {
if ( evts [ i ] . fn !== callback && evts [ i ] . fn . _ !== callback )
liveEvents . push ( evts [ i ] ) ;
}
}
( liveEvents . length )
? e [ name ] = liveEvents
: delete e [ name ] ;
return this ;
}
} ;
module . exports = E ;
module . exports . TinyEmitter = E ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
var __WEBPACK_AMD_DEFINE_FACTORY__ , __WEBPACK_AMD_DEFINE_ARRAY__ , __WEBPACK_AMD_DEFINE_RESULT__ ;
( function ( root , factory ) {
if ( true ) {
! ( __WEBPACK_AMD_DEFINE_ARRAY__ = [ ] , __WEBPACK_AMD_DEFINE_FACTORY__ = ( factory ) ,
__WEBPACK_AMD_DEFINE_RESULT__ = ( typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
( __WEBPACK_AMD_DEFINE_FACTORY__ . apply ( exports , __WEBPACK_AMD_DEFINE_ARRAY__ ) ) : __WEBPACK_AMD_DEFINE_FACTORY__ ) ,
__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && ( module . exports = __WEBPACK_AMD_DEFINE_RESULT__ ) ) ;
} else { }
} ( this , function ( ) {
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
var computeLayout = ( function ( ) {
var CSS_UNDEFINED ;
var CSS_DIRECTION_INHERIT = 'inherit' ;
var CSS_DIRECTION_LTR = 'ltr' ;
var CSS_DIRECTION_RTL = 'rtl' ;
var CSS_FLEX_DIRECTION_ROW = 'row' ;
var CSS_FLEX_DIRECTION_ROW_REVERSE = 'row-reverse' ;
var CSS_FLEX_DIRECTION_COLUMN = 'column' ;
var CSS_FLEX_DIRECTION_COLUMN_REVERSE = 'column-reverse' ;
var CSS_JUSTIFY_FLEX_START = 'flex-start' ;
var CSS_JUSTIFY_CENTER = 'center' ;
var CSS_JUSTIFY_FLEX_END = 'flex-end' ;
var CSS_JUSTIFY_SPACE_BETWEEN = 'space-between' ;
var CSS_JUSTIFY_SPACE_AROUND = 'space-around' ;
var CSS_ALIGN_FLEX_START = 'flex-start' ;
var CSS_ALIGN_CENTER = 'center' ;
var CSS_ALIGN_FLEX_END = 'flex-end' ;
var CSS_ALIGN_STRETCH = 'stretch' ;
var CSS_POSITION_RELATIVE = 'relative' ;
var CSS_POSITION_ABSOLUTE = 'absolute' ;
var leading = {
'row' : 'left' ,
'row-reverse' : 'right' ,
'column' : 'top' ,
'column-reverse' : 'bottom'
} ;
var trailing = {
'row' : 'right' ,
'row-reverse' : 'left' ,
'column' : 'bottom' ,
'column-reverse' : 'top'
} ;
var pos = {
'row' : 'left' ,
'row-reverse' : 'right' ,
'column' : 'top' ,
'column-reverse' : 'bottom'
} ;
var dim = {
'row' : 'width' ,
'row-reverse' : 'width' ,
'column' : 'height' ,
'column-reverse' : 'height'
} ;
function fillNodes ( node ) {
if ( ! node . layout || node . isDirty ) {
node . layout = {
width : undefined ,
height : undefined ,
top : 0 ,
left : 0 ,
right : 0 ,
bottom : 0
} ;
}
if ( ! node . style ) {
node . style = { } ;
}
if ( ! node . children ) {
node . children = [ ] ;
}
node . children . forEach ( fillNodes ) ;
return node ;
}
function isUndefined ( value ) {
return value === undefined ;
}
function isRowDirection ( flexDirection ) {
return flexDirection === CSS_FLEX_DIRECTION_ROW ||
flexDirection === CSS_FLEX_DIRECTION_ROW_REVERSE ;
}
function isColumnDirection ( flexDirection ) {
return flexDirection === CSS_FLEX_DIRECTION_COLUMN ||
flexDirection === CSS_FLEX_DIRECTION_COLUMN_REVERSE ;
}
function getLeadingMargin ( node , axis ) {
if ( node . style . marginStart !== undefined && isRowDirection ( axis ) ) {
return node . style . marginStart ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . marginLeft ; break ;
case 'row-reverse' : value = node . style . marginRight ; break ;
case 'column' : value = node . style . marginTop ; break ;
case 'column-reverse' : value = node . style . marginBottom ; break ;
}
if ( value !== undefined ) {
return value ;
}
if ( node . style . margin !== undefined ) {
return node . style . margin ;
}
return 0 ;
}
function getTrailingMargin ( node , axis ) {
if ( node . style . marginEnd !== undefined && isRowDirection ( axis ) ) {
return node . style . marginEnd ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . marginRight ; break ;
case 'row-reverse' : value = node . style . marginLeft ; break ;
case 'column' : value = node . style . marginBottom ; break ;
case 'column-reverse' : value = node . style . marginTop ; break ;
}
if ( value != null ) {
return value ;
}
if ( node . style . margin !== undefined ) {
return node . style . margin ;
}
return 0 ;
}
function getLeadingPadding ( node , axis ) {
if ( node . style . paddingStart !== undefined && node . style . paddingStart >= 0
&& isRowDirection ( axis ) ) {
return node . style . paddingStart ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . paddingLeft ; break ;
case 'row-reverse' : value = node . style . paddingRight ; break ;
case 'column' : value = node . style . paddingTop ; break ;
case 'column-reverse' : value = node . style . paddingBottom ; break ;
}
if ( value != null && value >= 0 ) {
return value ;
}
if ( node . style . padding !== undefined && node . style . padding >= 0 ) {
return node . style . padding ;
}
return 0 ;
}
function getTrailingPadding ( node , axis ) {
if ( node . style . paddingEnd !== undefined && node . style . paddingEnd >= 0
&& isRowDirection ( axis ) ) {
return node . style . paddingEnd ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . paddingRight ; break ;
case 'row-reverse' : value = node . style . paddingLeft ; break ;
case 'column' : value = node . style . paddingBottom ; break ;
case 'column-reverse' : value = node . style . paddingTop ; break ;
}
if ( value != null && value >= 0 ) {
return value ;
}
if ( node . style . padding !== undefined && node . style . padding >= 0 ) {
return node . style . padding ;
}
return 0 ;
}
function getLeadingBorder ( node , axis ) {
if ( node . style . borderStartWidth !== undefined && node . style . borderStartWidth >= 0
&& isRowDirection ( axis ) ) {
return node . style . borderStartWidth ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . borderLeftWidth ; break ;
case 'row-reverse' : value = node . style . borderRightWidth ; break ;
case 'column' : value = node . style . borderTopWidth ; break ;
case 'column-reverse' : value = node . style . borderBottomWidth ; break ;
}
if ( value != null && value >= 0 ) {
return value ;
}
if ( node . style . borderWidth !== undefined && node . style . borderWidth >= 0 ) {
return node . style . borderWidth ;
}
return 0 ;
}
function getTrailingBorder ( node , axis ) {
if ( node . style . borderEndWidth !== undefined && node . style . borderEndWidth >= 0
&& isRowDirection ( axis ) ) {
return node . style . borderEndWidth ;
}
var value = null ;
switch ( axis ) {
case 'row' : value = node . style . borderRightWidth ; break ;
case 'row-reverse' : value = node . style . borderLeftWidth ; break ;
case 'column' : value = node . style . borderBottomWidth ; break ;
case 'column-reverse' : value = node . style . borderTopWidth ; break ;
}
if ( value != null && value >= 0 ) {
return value ;
}
if ( node . style . borderWidth !== undefined && node . style . borderWidth >= 0 ) {
return node . style . borderWidth ;
}
return 0 ;
}
function getLeadingPaddingAndBorder ( node , axis ) {
return getLeadingPadding ( node , axis ) + getLeadingBorder ( node , axis ) ;
}
function getTrailingPaddingAndBorder ( node , axis ) {
return getTrailingPadding ( node , axis ) + getTrailingBorder ( node , axis ) ;
}
function getBorderAxis ( node , axis ) {
return getLeadingBorder ( node , axis ) + getTrailingBorder ( node , axis ) ;
}
function getMarginAxis ( node , axis ) {
return getLeadingMargin ( node , axis ) + getTrailingMargin ( node , axis ) ;
}
function getPaddingAndBorderAxis ( node , axis ) {
return getLeadingPaddingAndBorder ( node , axis ) +
getTrailingPaddingAndBorder ( node , axis ) ;
}
function getJustifyContent ( node ) {
if ( node . style . justifyContent ) {
return node . style . justifyContent ;
}
return 'flex-start' ;
}
function getAlignContent ( node ) {
if ( node . style . alignContent ) {
return node . style . alignContent ;
}
return 'flex-start' ;
}
function getAlignItem ( node , child ) {
if ( child . style . alignSelf ) {
return child . style . alignSelf ;
}
if ( node . style . alignItems ) {
return node . style . alignItems ;
}
return 'stretch' ;
}
function resolveAxis ( axis , direction ) {
if ( direction === CSS_DIRECTION_RTL ) {
if ( axis === CSS_FLEX_DIRECTION_ROW ) {
return CSS_FLEX_DIRECTION_ROW_REVERSE ;
} else if ( axis === CSS_FLEX_DIRECTION_ROW_REVERSE ) {
return CSS_FLEX_DIRECTION_ROW ;
}
}
return axis ;
}
function resolveDirection ( node , parentDirection ) {
var direction ;
if ( node . style . direction ) {
direction = node . style . direction ;
} else {
direction = CSS_DIRECTION_INHERIT ;
}
if ( direction === CSS_DIRECTION_INHERIT ) {
direction = ( parentDirection === undefined ? CSS_DIRECTION_LTR : parentDirection ) ;
}
return direction ;
}
function getFlexDirection ( node ) {
if ( node . style . flexDirection ) {
return node . style . flexDirection ;
}
return CSS_FLEX_DIRECTION_COLUMN ;
}
function getCrossFlexDirection ( flexDirection , direction ) {
if ( isColumnDirection ( flexDirection ) ) {
return resolveAxis ( CSS_FLEX_DIRECTION_ROW , direction ) ;
} else {
return CSS_FLEX_DIRECTION_COLUMN ;
}
}
function getPositionType ( node ) {
if ( node . style . position ) {
return node . style . position ;
}
return 'relative' ;
}
function isFlex ( node ) {
return (
getPositionType ( node ) === CSS_POSITION_RELATIVE &&
node . style . flex > 0
) ;
}
function isFlexWrap ( node ) {
return node . style . flexWrap === 'wrap' ;
}
function getDimWithMargin ( node , axis ) {
return node . layout [ dim [ axis ] ] + getMarginAxis ( node , axis ) ;
}
function isDimDefined ( node , axis ) {
return node . style [ dim [ axis ] ] !== undefined && node . style [ dim [ axis ] ] >= 0 ;
}
function isPosDefined ( node , pos ) {
return node . style [ pos ] !== undefined ;
}
function isMeasureDefined ( node ) {
return node . style . measure !== undefined ;
}
function getPosition ( node , pos ) {
if ( node . style [ pos ] !== undefined ) {
return node . style [ pos ] ;
}
return 0 ;
}
function boundAxis ( node , axis , value ) {
var min = {
'row' : node . style . minWidth ,
'row-reverse' : node . style . minWidth ,
'column' : node . style . minHeight ,
'column-reverse' : node . style . minHeight
} [ axis ] ;
var max = {
'row' : node . style . maxWidth ,
'row-reverse' : node . style . maxWidth ,
'column' : node . style . maxHeight ,
'column-reverse' : node . style . maxHeight
} [ axis ] ;
var boundValue = value ;
if ( max !== undefined && max >= 0 && boundValue > max ) {
boundValue = max ;
}
if ( min !== undefined && min >= 0 && boundValue < min ) {
boundValue = min ;
}
return boundValue ;
}
function fmaxf ( a , b ) {
if ( a > b ) {
return a ;
}
return b ;
}
function setDimensionFromStyle ( node , axis ) {
if ( node . layout [ dim [ axis ] ] !== undefined ) {
return ;
}
if ( ! isDimDefined ( node , axis ) ) {
return ;
}
node . layout [ dim [ axis ] ] = fmaxf (
boundAxis ( node , axis , node . style [ dim [ axis ] ] ) ,
getPaddingAndBorderAxis ( node , axis )
) ;
}
function setTrailingPosition ( node , child , axis ) {
child . layout [ trailing [ axis ] ] = node . layout [ dim [ axis ] ] -
child . layout [ dim [ axis ] ] - child . layout [ pos [ axis ] ] ;
}
function getRelativePosition ( node , axis ) {
if ( node . style [ leading [ axis ] ] !== undefined ) {
return getPosition ( node , leading [ axis ] ) ;
}
return - getPosition ( node , trailing [ axis ] ) ;
}
function layoutNodeImpl ( node , parentMaxWidth , parentDirection ) {
var direction = resolveDirection ( node , parentDirection ) ;
var mainAxis = resolveAxis ( getFlexDirection ( node ) , direction ) ;
var crossAxis = getCrossFlexDirection ( mainAxis , direction ) ;
var resolvedRowAxis = resolveAxis ( CSS_FLEX_DIRECTION_ROW , direction ) ;
setDimensionFromStyle ( node , mainAxis ) ;
setDimensionFromStyle ( node , crossAxis ) ;
node . layout . direction = direction ;
node . layout [ leading [ mainAxis ] ] += getLeadingMargin ( node , mainAxis ) +
getRelativePosition ( node , mainAxis ) ;
node . layout [ trailing [ mainAxis ] ] += getTrailingMargin ( node , mainAxis ) +
getRelativePosition ( node , mainAxis ) ;
node . layout [ leading [ crossAxis ] ] += getLeadingMargin ( node , crossAxis ) +
getRelativePosition ( node , crossAxis ) ;
node . layout [ trailing [ crossAxis ] ] += getTrailingMargin ( node , crossAxis ) +
getRelativePosition ( node , crossAxis ) ;
var childCount = node . children . length ;
var paddingAndBorderAxisResolvedRow = getPaddingAndBorderAxis ( node , resolvedRowAxis ) ;
if ( isMeasureDefined ( node ) ) {
var isResolvedRowDimDefined = ! isUndefined ( node . layout [ dim [ resolvedRowAxis ] ] ) ;
var width = CSS_UNDEFINED ;
if ( isDimDefined ( node , resolvedRowAxis ) ) {
width = node . style . width ;
} else if ( isResolvedRowDimDefined ) {
width = node . layout [ dim [ resolvedRowAxis ] ] ;
} else {
width = parentMaxWidth -
getMarginAxis ( node , resolvedRowAxis ) ;
}
width -= paddingAndBorderAxisResolvedRow ;
var isRowUndefined = ! isDimDefined ( node , resolvedRowAxis ) && ! isResolvedRowDimDefined ;
var isColumnUndefined = ! isDimDefined ( node , CSS_FLEX_DIRECTION_COLUMN ) &&
isUndefined ( node . layout [ dim [ CSS_FLEX_DIRECTION_COLUMN ] ] ) ;
if ( isRowUndefined || isColumnUndefined ) {
var measureDim = node . style . measure (
width
) ;
if ( isRowUndefined ) {
node . layout . width = measureDim . width +
paddingAndBorderAxisResolvedRow ;
}
if ( isColumnUndefined ) {
node . layout . height = measureDim . height +
getPaddingAndBorderAxis ( node , CSS_FLEX_DIRECTION_COLUMN ) ;
}
}
if ( childCount === 0 ) {
return ;
}
}
var isNodeFlexWrap = isFlexWrap ( node ) ;
var justifyContent = getJustifyContent ( node ) ;
var leadingPaddingAndBorderMain = getLeadingPaddingAndBorder ( node , mainAxis ) ;
var leadingPaddingAndBorderCross = getLeadingPaddingAndBorder ( node , crossAxis ) ;
var paddingAndBorderAxisMain = getPaddingAndBorderAxis ( node , mainAxis ) ;
var paddingAndBorderAxisCross = getPaddingAndBorderAxis ( node , crossAxis ) ;
var isMainDimDefined = ! isUndefined ( node . layout [ dim [ mainAxis ] ] ) ;
var isCrossDimDefined = ! isUndefined ( node . layout [ dim [ crossAxis ] ] ) ;
var isMainRowDirection = isRowDirection ( mainAxis ) ;
var i ;
var ii ;
var child ;
var axis ;
var firstAbsoluteChild = null ;
var currentAbsoluteChild = null ;
var definedMainDim = CSS_UNDEFINED ;
if ( isMainDimDefined ) {
definedMainDim = node . layout [ dim [ mainAxis ] ] - paddingAndBorderAxisMain ;
}
var startLine = 0 ;
var endLine = 0 ;
var alreadyComputedNextLayout = 0 ;
var linesCrossDim = 0 ;
var linesMainDim = 0 ;
var linesCount = 0 ;
while ( endLine < childCount ) {
var mainContentDim = 0 ;
var flexibleChildrenCount = 0 ;
var totalFlexible = 0 ;
var nonFlexibleChildrenCount = 0 ;
var isSimpleStackMain =
( isMainDimDefined && justifyContent === CSS_JUSTIFY_FLEX_START ) ||
( ! isMainDimDefined && justifyContent !== CSS_JUSTIFY_CENTER ) ;
var firstComplexMain = ( isSimpleStackMain ? childCount : startLine ) ;
var isSimpleStackCross = true ;
var firstComplexCross = childCount ;
var firstFlexChild = null ;
var currentFlexChild = null ;
var mainDim = leadingPaddingAndBorderMain ;
var crossDim = 0 ;
var maxWidth ;
for ( i = startLine ; i < childCount ; ++ i ) {
child = node . children [ i ] ;
child . lineIndex = linesCount ;
child . nextAbsoluteChild = null ;
child . nextFlexChild = null ;
var alignItem = getAlignItem ( node , child ) ;
if ( alignItem === CSS_ALIGN_STRETCH &&
getPositionType ( child ) === CSS_POSITION_RELATIVE &&
isCrossDimDefined &&
! isDimDefined ( child , crossAxis ) ) {
child . layout [ dim [ crossAxis ] ] = fmaxf (
boundAxis ( child , crossAxis , node . layout [ dim [ crossAxis ] ] -
paddingAndBorderAxisCross - getMarginAxis ( child , crossAxis ) ) ,
getPaddingAndBorderAxis ( child , crossAxis )
) ;
} else if ( getPositionType ( child ) === CSS_POSITION_ABSOLUTE ) {
if ( firstAbsoluteChild === null ) {
firstAbsoluteChild = child ;
}
if ( currentAbsoluteChild !== null ) {
currentAbsoluteChild . nextAbsoluteChild = child ;
}
currentAbsoluteChild = child ;
for ( ii = 0 ; ii < 2 ; ii ++ ) {
axis = ( ii !== 0 ) ? CSS_FLEX_DIRECTION_ROW : CSS_FLEX_DIRECTION_COLUMN ;
if ( ! isUndefined ( node . layout [ dim [ axis ] ] ) &&
! isDimDefined ( child , axis ) &&
isPosDefined ( child , leading [ axis ] ) &&
isPosDefined ( child , trailing [ axis ] ) ) {
child . layout [ dim [ axis ] ] = fmaxf (
boundAxis ( child , axis , node . layout [ dim [ axis ] ] -
getPaddingAndBorderAxis ( node , axis ) -
getMarginAxis ( child , axis ) -
getPosition ( child , leading [ axis ] ) -
getPosition ( child , trailing [ axis ] ) ) ,
getPaddingAndBorderAxis ( child , axis )
) ;
}
}
}
var nextContentDim = 0 ;
if ( isMainDimDefined && isFlex ( child ) ) {
flexibleChildrenCount ++ ;
totalFlexible += child . style . flex ;
if ( firstFlexChild === null ) {
firstFlexChild = child ;
}
if ( currentFlexChild !== null ) {
currentFlexChild . nextFlexChild = child ;
}
currentFlexChild = child ;
nextContentDim = getPaddingAndBorderAxis ( child , mainAxis ) +
getMarginAxis ( child , mainAxis ) ;
} else {
maxWidth = CSS_UNDEFINED ;
if ( ! isMainRowDirection ) {
if ( isDimDefined ( node , resolvedRowAxis ) ) {
maxWidth = node . layout [ dim [ resolvedRowAxis ] ] -
paddingAndBorderAxisResolvedRow ;
} else {
maxWidth = parentMaxWidth -
getMarginAxis ( node , resolvedRowAxis ) -
paddingAndBorderAxisResolvedRow ;
}
}
if ( alreadyComputedNextLayout === 0 ) {
layoutNode ( child , maxWidth , direction ) ;
}
if ( getPositionType ( child ) === CSS_POSITION_RELATIVE ) {
nonFlexibleChildrenCount ++ ;
nextContentDim = getDimWithMargin ( child , mainAxis ) ;
}
}
if ( isNodeFlexWrap &&
isMainDimDefined &&
mainContentDim + nextContentDim > definedMainDim &&
i !== startLine ) {
nonFlexibleChildrenCount -- ;
alreadyComputedNextLayout = 1 ;
break ;
}
if ( isSimpleStackMain &&
( getPositionType ( child ) !== CSS_POSITION_RELATIVE || isFlex ( child ) ) ) {
isSimpleStackMain = false ;
firstComplexMain = i ;
}
if ( isSimpleStackCross &&
( getPositionType ( child ) !== CSS_POSITION_RELATIVE ||
( alignItem !== CSS_ALIGN_STRETCH && alignItem !== CSS_ALIGN_FLEX_START ) ||
isUndefined ( child . layout [ dim [ crossAxis ] ] ) ) ) {
isSimpleStackCross = false ;
firstComplexCross = i ;
}
if ( isSimpleStackMain ) {
child . layout [ pos [ mainAxis ] ] += mainDim ;
if ( isMainDimDefined ) {
setTrailingPosition ( node , child , mainAxis ) ;
}
mainDim += getDimWithMargin ( child , mainAxis ) ;
crossDim = fmaxf ( crossDim , boundAxis ( child , crossAxis , getDimWithMargin ( child , crossAxis ) ) ) ;
}
if ( isSimpleStackCross ) {
child . layout [ pos [ crossAxis ] ] += linesCrossDim + leadingPaddingAndBorderCross ;
if ( isCrossDimDefined ) {
setTrailingPosition ( node , child , crossAxis ) ;
}
}
alreadyComputedNextLayout = 0 ;
mainContentDim += nextContentDim ;
endLine = i + 1 ;
}
var leadingMainDim = 0 ;
var betweenMainDim = 0 ;
var remainingMainDim = 0 ;
if ( isMainDimDefined ) {
remainingMainDim = definedMainDim - mainContentDim ;
} else {
remainingMainDim = fmaxf ( mainContentDim , 0 ) - mainContentDim ;
}
if ( flexibleChildrenCount !== 0 ) {
var flexibleMainDim = remainingMainDim / totalFlexible ;
var baseMainDim ;
var boundMainDim ;
currentFlexChild = firstFlexChild ;
while ( currentFlexChild !== null ) {
baseMainDim = flexibleMainDim * currentFlexChild . style . flex +
getPaddingAndBorderAxis ( currentFlexChild , mainAxis ) ;
boundMainDim = boundAxis ( currentFlexChild , mainAxis , baseMainDim ) ;
if ( baseMainDim !== boundMainDim ) {
remainingMainDim -= boundMainDim ;
totalFlexible -= currentFlexChild . style . flex ;
}
currentFlexChild = currentFlexChild . nextFlexChild ;
}
flexibleMainDim = remainingMainDim / totalFlexible ;
if ( flexibleMainDim < 0 ) {
flexibleMainDim = 0 ;
}
currentFlexChild = firstFlexChild ;
while ( currentFlexChild !== null ) {
currentFlexChild . layout [ dim [ mainAxis ] ] = boundAxis ( currentFlexChild , mainAxis ,
flexibleMainDim * currentFlexChild . style . flex +
getPaddingAndBorderAxis ( currentFlexChild , mainAxis )
) ;
maxWidth = CSS_UNDEFINED ;
if ( isDimDefined ( node , resolvedRowAxis ) ) {
maxWidth = node . layout [ dim [ resolvedRowAxis ] ] -
paddingAndBorderAxisResolvedRow ;
} else if ( ! isMainRowDirection ) {
maxWidth = parentMaxWidth -
getMarginAxis ( node , resolvedRowAxis ) -
paddingAndBorderAxisResolvedRow ;
}
layoutNode ( currentFlexChild , maxWidth , direction ) ;
child = currentFlexChild ;
currentFlexChild = currentFlexChild . nextFlexChild ;
child . nextFlexChild = null ;
}
} else if ( justifyContent !== CSS_JUSTIFY_FLEX_START ) {
if ( justifyContent === CSS_JUSTIFY_CENTER ) {
leadingMainDim = remainingMainDim / 2 ;
} else if ( justifyContent === CSS_JUSTIFY_FLEX_END ) {
leadingMainDim = remainingMainDim ;
} else if ( justifyContent === CSS_JUSTIFY_SPACE_BETWEEN ) {
remainingMainDim = fmaxf ( remainingMainDim , 0 ) ;
if ( flexibleChildrenCount + nonFlexibleChildrenCount - 1 !== 0 ) {
betweenMainDim = remainingMainDim /
( flexibleChildrenCount + nonFlexibleChildrenCount - 1 ) ;
} else {
betweenMainDim = 0 ;
}
} else if ( justifyContent === CSS_JUSTIFY_SPACE_AROUND ) {
betweenMainDim = remainingMainDim /
( flexibleChildrenCount + nonFlexibleChildrenCount ) ;
leadingMainDim = betweenMainDim / 2 ;
}
}
mainDim += leadingMainDim ;
for ( i = firstComplexMain ; i < endLine ; ++ i ) {
child = node . children [ i ] ;
if ( getPositionType ( child ) === CSS_POSITION_ABSOLUTE &&
isPosDefined ( child , leading [ mainAxis ] ) ) {
child . layout [ pos [ mainAxis ] ] = getPosition ( child , leading [ mainAxis ] ) +
getLeadingBorder ( node , mainAxis ) +
getLeadingMargin ( child , mainAxis ) ;
} else {
child . layout [ pos [ mainAxis ] ] += mainDim ;
if ( isMainDimDefined ) {
setTrailingPosition ( node , child , mainAxis ) ;
}
if ( getPositionType ( child ) === CSS_POSITION_RELATIVE ) {
mainDim += betweenMainDim + getDimWithMargin ( child , mainAxis ) ;
crossDim = fmaxf ( crossDim , boundAxis ( child , crossAxis , getDimWithMargin ( child , crossAxis ) ) ) ;
}
}
}
var containerCrossAxis = node . layout [ dim [ crossAxis ] ] ;
if ( ! isCrossDimDefined ) {
containerCrossAxis = fmaxf (
boundAxis ( node , crossAxis , crossDim + paddingAndBorderAxisCross ) ,
paddingAndBorderAxisCross
) ;
}
for ( i = firstComplexCross ; i < endLine ; ++ i ) {
child = node . children [ i ] ;
if ( getPositionType ( child ) === CSS_POSITION_ABSOLUTE &&
isPosDefined ( child , leading [ crossAxis ] ) ) {
child . layout [ pos [ crossAxis ] ] = getPosition ( child , leading [ crossAxis ] ) +
getLeadingBorder ( node , crossAxis ) +
getLeadingMargin ( child , crossAxis ) ;
} else {
var leadingCrossDim = leadingPaddingAndBorderCross ;
if ( getPositionType ( child ) === CSS_POSITION_RELATIVE ) {
var alignItem = getAlignItem ( node , child ) ;
if ( alignItem === CSS_ALIGN_STRETCH ) {
if ( isUndefined ( child . layout [ dim [ crossAxis ] ] ) ) {
child . layout [ dim [ crossAxis ] ] = fmaxf (
boundAxis ( child , crossAxis , containerCrossAxis -
paddingAndBorderAxisCross - getMarginAxis ( child , crossAxis ) ) ,
getPaddingAndBorderAxis ( child , crossAxis )
) ;
}
} else if ( alignItem !== CSS_ALIGN_FLEX_START ) {
var remainingCrossDim = containerCrossAxis -
paddingAndBorderAxisCross - getDimWithMargin ( child , crossAxis ) ;
if ( alignItem === CSS_ALIGN_CENTER ) {
leadingCrossDim += remainingCrossDim / 2 ;
} else {
leadingCrossDim += remainingCrossDim ;
}
}
}
child . layout [ pos [ crossAxis ] ] += linesCrossDim + leadingCrossDim ;
if ( isCrossDimDefined ) {
setTrailingPosition ( node , child , crossAxis ) ;
}
}
}
linesCrossDim += crossDim ;
linesMainDim = fmaxf ( linesMainDim , mainDim ) ;
linesCount += 1 ;
startLine = endLine ;
}
if ( linesCount > 1 && isCrossDimDefined ) {
var nodeCrossAxisInnerSize = node . layout [ dim [ crossAxis ] ] -
paddingAndBorderAxisCross ;
var remainingAlignContentDim = nodeCrossAxisInnerSize - linesCrossDim ;
var crossDimLead = 0 ;
var currentLead = leadingPaddingAndBorderCross ;
var alignContent = getAlignContent ( node ) ;
if ( alignContent === CSS_ALIGN_FLEX_END ) {
currentLead += remainingAlignContentDim ;
} else if ( alignContent === CSS_ALIGN_CENTER ) {
currentLead += remainingAlignContentDim / 2 ;
} else if ( alignContent === CSS_ALIGN_STRETCH ) {
if ( nodeCrossAxisInnerSize > linesCrossDim ) {
crossDimLead = ( remainingAlignContentDim / linesCount ) ;
}
}
var endIndex = 0 ;
for ( i = 0 ; i < linesCount ; ++ i ) {
var startIndex = endIndex ;
var lineHeight = 0 ;
for ( ii = startIndex ; ii < childCount ; ++ ii ) {
child = node . children [ ii ] ;
if ( getPositionType ( child ) !== CSS_POSITION_RELATIVE ) {
continue ;
}
if ( child . lineIndex !== i ) {
break ;
}
if ( ! isUndefined ( child . layout [ dim [ crossAxis ] ] ) ) {
lineHeight = fmaxf (
lineHeight ,
child . layout [ dim [ crossAxis ] ] + getMarginAxis ( child , crossAxis )
) ;
}
}
endIndex = ii ;
lineHeight += crossDimLead ;
for ( ii = startIndex ; ii < endIndex ; ++ ii ) {
child = node . children [ ii ] ;
if ( getPositionType ( child ) !== CSS_POSITION_RELATIVE ) {
continue ;
}
var alignContentAlignItem = getAlignItem ( node , child ) ;
if ( alignContentAlignItem === CSS_ALIGN_FLEX_START ) {
child . layout [ pos [ crossAxis ] ] = currentLead + getLeadingMargin ( child , crossAxis ) ;
} else if ( alignContentAlignItem === CSS_ALIGN_FLEX_END ) {
child . layout [ pos [ crossAxis ] ] = currentLead + lineHeight - getTrailingMargin ( child , crossAxis ) - child . layout [ dim [ crossAxis ] ] ;
} else if ( alignContentAlignItem === CSS_ALIGN_CENTER ) {
var childHeight = child . layout [ dim [ crossAxis ] ] ;
child . layout [ pos [ crossAxis ] ] = currentLead + ( lineHeight - childHeight ) / 2 ;
} else if ( alignContentAlignItem === CSS_ALIGN_STRETCH ) {
child . layout [ pos [ crossAxis ] ] = currentLead + getLeadingMargin ( child , crossAxis ) ;
}
}
currentLead += lineHeight ;
}
}
var needsMainTrailingPos = false ;
var needsCrossTrailingPos = false ;
if ( ! isMainDimDefined ) {
node . layout [ dim [ mainAxis ] ] = fmaxf (
boundAxis ( node , mainAxis , linesMainDim + getTrailingPaddingAndBorder ( node , mainAxis ) ) ,
paddingAndBorderAxisMain
) ;
if ( mainAxis === CSS_FLEX_DIRECTION_ROW_REVERSE ||
mainAxis === CSS_FLEX_DIRECTION_COLUMN_REVERSE ) {
needsMainTrailingPos = true ;
}
}
if ( ! isCrossDimDefined ) {
node . layout [ dim [ crossAxis ] ] = fmaxf (
boundAxis ( node , crossAxis , linesCrossDim + paddingAndBorderAxisCross ) ,
paddingAndBorderAxisCross
) ;
if ( crossAxis === CSS_FLEX_DIRECTION_ROW_REVERSE ||
crossAxis === CSS_FLEX_DIRECTION_COLUMN_REVERSE ) {
needsCrossTrailingPos = true ;
}
}
if ( needsMainTrailingPos || needsCrossTrailingPos ) {
for ( i = 0 ; i < childCount ; ++ i ) {
child = node . children [ i ] ;
if ( needsMainTrailingPos ) {
setTrailingPosition ( node , child , mainAxis ) ;
}
if ( needsCrossTrailingPos ) {
setTrailingPosition ( node , child , crossAxis ) ;
}
}
}
currentAbsoluteChild = firstAbsoluteChild ;
while ( currentAbsoluteChild !== null ) {
for ( ii = 0 ; ii < 2 ; ii ++ ) {
axis = ( ii !== 0 ) ? CSS_FLEX_DIRECTION_ROW : CSS_FLEX_DIRECTION_COLUMN ;
if ( ! isUndefined ( node . layout [ dim [ axis ] ] ) &&
! isDimDefined ( currentAbsoluteChild , axis ) &&
isPosDefined ( currentAbsoluteChild , leading [ axis ] ) &&
isPosDefined ( currentAbsoluteChild , trailing [ axis ] ) ) {
currentAbsoluteChild . layout [ dim [ axis ] ] = fmaxf (
boundAxis ( currentAbsoluteChild , axis , node . layout [ dim [ axis ] ] -
getBorderAxis ( node , axis ) -
getMarginAxis ( currentAbsoluteChild , axis ) -
getPosition ( currentAbsoluteChild , leading [ axis ] ) -
getPosition ( currentAbsoluteChild , trailing [ axis ] )
) ,
getPaddingAndBorderAxis ( currentAbsoluteChild , axis )
) ;
}
if ( isPosDefined ( currentAbsoluteChild , trailing [ axis ] ) &&
! isPosDefined ( currentAbsoluteChild , leading [ axis ] ) ) {
currentAbsoluteChild . layout [ leading [ axis ] ] =
node . layout [ dim [ axis ] ] -
currentAbsoluteChild . layout [ dim [ axis ] ] -
getPosition ( currentAbsoluteChild , trailing [ axis ] ) ;
}
}
child = currentAbsoluteChild ;
currentAbsoluteChild = currentAbsoluteChild . nextAbsoluteChild ;
child . nextAbsoluteChild = null ;
}
}
function layoutNode ( node , parentMaxWidth , parentDirection ) {
node . shouldUpdate = true ;
var direction = node . style . direction || CSS_DIRECTION_LTR ;
var skipLayout =
! node . isDirty &&
node . lastLayout &&
node . lastLayout . requestedHeight === node . layout . height &&
node . lastLayout . requestedWidth === node . layout . width &&
node . lastLayout . parentMaxWidth === parentMaxWidth &&
node . lastLayout . direction === direction ;
if ( skipLayout ) {
node . layout . width = node . lastLayout . width ;
node . layout . height = node . lastLayout . height ;
node . layout . top = node . lastLayout . top ;
node . layout . left = node . lastLayout . left ;
} else {
if ( ! node . lastLayout ) {
node . lastLayout = { } ;
}
node . lastLayout . requestedWidth = node . layout . width ;
node . lastLayout . requestedHeight = node . layout . height ;
node . lastLayout . parentMaxWidth = parentMaxWidth ;
node . lastLayout . direction = direction ;
node . children . forEach ( function ( child ) {
child . layout . width = undefined ;
child . layout . height = undefined ;
child . layout . top = 0 ;
child . layout . left = 0 ;
} ) ;
layoutNodeImpl ( node , parentMaxWidth , parentDirection ) ;
node . lastLayout . width = node . layout . width ;
node . lastLayout . height = node . layout . height ;
node . lastLayout . top = node . layout . top ;
node . lastLayout . left = node . layout . left ;
}
}
return {
layoutNodeImpl : layoutNodeImpl ,
computeLayout : layoutNode ,
fillNodes : fillNodes
} ;
} ) ( ) ;
if ( true ) {
module . exports = computeLayout ;
}
return function ( node ) {
computeLayout . fillNodes ( node ) ;
computeLayout . computeLayout ( node ) ;
} ;
} ) ) ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
var nodeToJson = __webpack_require__ ( 11 ) ;
var xmlToNodeobj = __webpack_require__ ( 13 ) ;
var x2xmlnode = __webpack_require__ ( 13 ) ;
var buildOptions = __webpack_require__ ( 12 ) . buildOptions ;
var validator = __webpack_require__ ( 15 ) ;
exports . parse = function ( xmlData , options , validationOption ) {
if ( validationOption ) {
if ( validationOption === true ) validationOption = { } ;
var result = validator . validate ( xmlData , validationOption ) ;
if ( result !== true ) {
throw Error ( result . err . msg ) ;
}
}
options = buildOptions ( options , x2xmlnode . defaultOptions , x2xmlnode . props ) ;
return nodeToJson . convertToJson ( xmlToNodeobj . getTraversalObj ( xmlData , options ) , options ) ;
} ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
var util = __webpack_require__ ( 12 ) ;
var convertToJson = function convertToJson ( node , options ) {
var jObj = {
name : node . tagname
} ;
if ( ( ! node . child || util . isEmptyObject ( node . child ) ) && ( ! node . attrsMap || util . isEmptyObject ( node . attrsMap ) ) ) {
return util . isExist ( node . val ) && ! ! node . val ? node . val : jObj ;
} else {
if ( util . isExist ( node . val ) ) {
if ( ! ( typeof node . val === 'string' && ( node . val === '' || node . val === options . cdataPositionChar ) ) ) {
if ( options . arrayMode === "strict" ) {
jObj [ options . textNodeName ] = [ node . val ] ;
} else {
jObj [ options . textNodeName ] = node . val ;
}
}
}
}
util . merge ( jObj , node . attrsMap , options . arrayMode ) ;
jObj . children = [ ] ;
node . children . forEach ( function ( child ) {
jObj . children . push ( convertToJson ( child , options ) ) ;
} ) ;
return jObj ;
} ;
exports . convertToJson = convertToJson ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
var getAllMatches = function getAllMatches ( string , regex ) {
var matches = [ ] ;
var match = regex . exec ( string ) ;
while ( match ) {
var allmatches = [ ] ;
var len = match . length ;
for ( var index = 0 ; index < len ; index ++ ) {
allmatches . push ( match [ index ] ) ;
}
matches . push ( allmatches ) ;
match = regex . exec ( string ) ;
}
return matches ;
} ;
var doesMatch = function doesMatch ( string , regex ) {
var match = regex . exec ( string ) ;
return ! ( match === null || typeof match === 'undefined' ) ;
} ;
var doesNotMatch = function doesNotMatch ( string , regex ) {
return ! doesMatch ( string , regex ) ;
} ;
exports . isExist = function ( v ) {
return typeof v !== 'undefined' ;
} ;
exports . isEmptyObject = function ( obj ) {
return Object . keys ( obj ) . length === 0 ;
} ;
exports . merge = function ( target , a , arrayMode ) {
if ( a ) {
var keys = Object . keys ( a ) ;
var len = keys . length ;
for ( var i = 0 ; i < len ; i ++ ) {
if ( arrayMode === 'strict' ) {
target [ keys [ i ] ] = [ a [ keys [ i ] ] ] ;
} else {
target [ keys [ i ] ] = a [ keys [ i ] ] ;
}
}
}
} ;
exports . getValue = function ( v ) {
if ( exports . isExist ( v ) ) {
return v ;
} else {
return '' ;
}
} ;
exports . buildOptions = function ( options , defaultOptions , props ) {
var newOptions = { } ;
if ( ! options ) {
return defaultOptions ;
}
for ( var i = 0 ; i < props . length ; i ++ ) {
if ( options [ props [ i ] ] !== undefined ) {
newOptions [ props [ i ] ] = options [ props [ i ] ] ;
} else {
newOptions [ props [ i ] ] = defaultOptions [ props [ i ] ] ;
}
}
return newOptions ;
} ;
exports . doesMatch = doesMatch ;
exports . doesNotMatch = doesNotMatch ;
exports . getAllMatches = getAllMatches ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
var util = __webpack_require__ ( 12 ) ;
var buildOptions = __webpack_require__ ( 12 ) . buildOptions ;
var xmlNode = __webpack_require__ ( 14 ) ;
var TagType = {
OPENING : 1 ,
CLOSING : 2 ,
SELF : 3 ,
CDATA : 4
} ;
var regx = '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|(([\\w:\\-._]*:)?([\\w:\\-._]+))([^>]*)>|((\\/)(([\\w:\\-._]*:)?([\\w:\\-._]+))\\s*>))([^<]*)' ;
if ( ! Number . parseInt && window . parseInt ) {
Number . parseInt = window . parseInt ;
}
if ( ! Number . parseFloat && window . parseFloat ) {
Number . parseFloat = window . parseFloat ;
}
var defaultOptions = {
attributeNamePrefix : '@_' ,
attrNodeName : false ,
textNodeName : '#text' ,
ignoreAttributes : true ,
ignoreNameSpace : false ,
allowBooleanAttributes : false ,
parseNodeValue : true ,
parseAttributeValue : false ,
arrayMode : false ,
trimValues : true ,
cdataTagName : false ,
cdataPositionChar : '\\c' ,
localeRange : '' ,
tagValueProcessor : function tagValueProcessor ( a ) {
return a ;
} ,
attrValueProcessor : function attrValueProcessor ( a ) {
return a ;
} ,
stopNodes : [ ]
} ;
exports . defaultOptions = defaultOptions ;
var props = [ 'attributeNamePrefix' , 'attrNodeName' , 'textNodeName' , 'ignoreAttributes' , 'ignoreNameSpace' , 'allowBooleanAttributes' , 'parseNodeValue' , 'parseAttributeValue' , 'arrayMode' , 'trimValues' , 'cdataTagName' , 'cdataPositionChar' , 'localeRange' , 'tagValueProcessor' , 'attrValueProcessor' , 'parseTrueNumberOnly' , 'stopNodes' ] ;
exports . props = props ;
var getTraversalObj = function getTraversalObj ( xmlData , options ) {
options = buildOptions ( options , defaultOptions , props ) ;
xmlData = xmlData . replace ( /<!--[\s\S]*?-->/g , '' ) ;
var xmlObj = new xmlNode ( '!xml' ) ;
var currentNode = xmlObj ;
regx = regx . replace ( /\[\\w/g , '[' + options . localeRange + '\\w' ) ;
var tagsRegx = new RegExp ( regx , 'g' ) ;
var tag = tagsRegx . exec ( xmlData ) ;
var nextTag = tagsRegx . exec ( xmlData ) ;
while ( tag ) {
var tagType = checkForTagType ( tag ) ;
if ( tagType === TagType . CLOSING ) {
if ( currentNode . parent && tag [ 14 ] ) {
currentNode . parent . val = util . getValue ( currentNode . parent . val ) + '' + processTagValue ( tag , options , currentNode . parent . tagname ) ;
}
if ( options . stopNodes . length && options . stopNodes . includes ( currentNode . tagname ) ) {
currentNode . child = [ ] ;
if ( currentNode . attrsMap == undefined ) {
currentNode . attrsMap = { } ;
}
currentNode . val = xmlData . substr ( currentNode . startIndex + 1 , tag . index - currentNode . startIndex - 1 ) ;
}
currentNode = currentNode . parent ;
} else if ( tagType === TagType . CDATA ) {
if ( options . cdataTagName ) {
var childNode = new xmlNode ( options . cdataTagName , currentNode , tag [ 3 ] ) ;
childNode . attrsMap = buildAttributesMap ( tag [ 8 ] , options ) ;
currentNode . addChild ( childNode ) ;
currentNode . val = util . getValue ( currentNode . val ) + options . cdataPositionChar ;
if ( tag [ 14 ] ) {
currentNode . val += processTagValue ( tag , options ) ;
}
} else {
currentNode . val = ( currentNode . val || '' ) + ( tag [ 3 ] || '' ) + processTagValue ( tag , options ) ;
}
} else if ( tagType === TagType . SELF ) {
if ( currentNode && tag [ 14 ] ) {
currentNode . val = util . getValue ( currentNode . val ) + '' + processTagValue ( tag , options ) ;
}
var _childNode = new xmlNode ( options . ignoreNameSpace ? tag [ 7 ] : tag [ 5 ] , currentNode , '' ) ;
if ( tag [ 8 ] && tag [ 8 ] . length > 0 ) {
tag [ 8 ] = tag [ 8 ] . substr ( 0 , tag [ 8 ] . length - 1 ) ;
}
_childNode . attrsMap = buildAttributesMap ( tag [ 8 ] , options ) ;
currentNode . addChild ( _childNode ) ;
} else {
var _childNode2 = new xmlNode ( options . ignoreNameSpace ? tag [ 7 ] : tag [ 5 ] , currentNode , processTagValue ( tag , options ) ) ;
if ( options . stopNodes . length && options . stopNodes . includes ( _childNode2 . tagname ) ) {
_childNode2 . startIndex = tag . index + tag [ 1 ] . length ;
}
_childNode2 . attrsMap = buildAttributesMap ( tag [ 8 ] , options ) ;
currentNode . addChild ( _childNode2 ) ;
currentNode = _childNode2 ;
}
tag = nextTag ;
nextTag = tagsRegx . exec ( xmlData ) ;
}
return xmlObj ;
} ;
function processTagValue ( parsedTags , options , parentTagName ) {
var tagName = parsedTags [ 7 ] || parentTagName ;
var val = parsedTags [ 14 ] ;
if ( val ) {
if ( options . trimValues ) {
val = val . trim ( ) ;
}
val = options . tagValueProcessor ( val , tagName ) ;
val = parseValue ( val , options . parseNodeValue , options . parseTrueNumberOnly ) ;
}
return val ;
}
function checkForTagType ( match ) {
if ( match [ 4 ] === ']]>' ) {
return TagType . CDATA ;
} else if ( match [ 10 ] === '/' ) {
return TagType . CLOSING ;
} else if ( typeof match [ 8 ] !== 'undefined' && match [ 8 ] . substr ( match [ 8 ] . length - 1 ) === '/' ) {
return TagType . SELF ;
} else {
return TagType . OPENING ;
}
}
function resolveNameSpace ( tagname , options ) {
if ( options . ignoreNameSpace ) {
var tags = tagname . split ( ':' ) ;
var prefix = tagname . charAt ( 0 ) === '/' ? '/' : '' ;
if ( tags [ 0 ] === 'xmlns' ) {
return '' ;
}
if ( tags . length === 2 ) {
tagname = prefix + tags [ 1 ] ;
}
}
return tagname ;
}
function parseValue ( val , shouldParse , parseTrueNumberOnly ) {
if ( shouldParse && typeof val === 'string' ) {
var parsed ;
if ( val . trim ( ) === '' || isNaN ( val ) ) {
parsed = val === 'true' ? true : val === 'false' ? false : val ;
} else {
if ( val . indexOf ( '0x' ) !== - 1 ) {
parsed = Number . parseInt ( val , 16 ) ;
} else if ( val . indexOf ( '.' ) !== - 1 ) {
parsed = Number . parseFloat ( val ) ;
} else {
parsed = Number . parseInt ( val , 10 ) ;
}
if ( parseTrueNumberOnly ) {
parsed = String ( parsed ) === val ? parsed : val ;
}
}
return parsed ;
} else {
if ( util . isExist ( val ) ) {
return val ;
} else {
return '' ;
}
}
}
var attrsRegx = new RegExp ( '([^\\s=]+)\\s*(=\\s*([\'"])(.*?)\\3)?' , 'g' ) ;
function buildAttributesMap ( attrStr , options ) {
if ( ! options . ignoreAttributes && typeof attrStr === 'string' ) {
attrStr = attrStr . replace ( /\r?\n/g , ' ' ) ;
var matches = util . getAllMatches ( attrStr , attrsRegx ) ;
var len = matches . length ;
var attrs = { } ;
for ( var i = 0 ; i < len ; i ++ ) {
var attrName = resolveNameSpace ( matches [ i ] [ 1 ] , options ) ;
if ( attrName . length ) {
if ( matches [ i ] [ 4 ] !== undefined ) {
if ( options . trimValues ) {
matches [ i ] [ 4 ] = matches [ i ] [ 4 ] . trim ( ) ;
}
matches [ i ] [ 4 ] = options . attrValueProcessor ( matches [ i ] [ 4 ] , attrName ) ;
attrs [ options . attributeNamePrefix + attrName ] = parseValue ( matches [ i ] [ 4 ] , options . parseAttributeValue , options . parseTrueNumberOnly ) ;
} else if ( options . allowBooleanAttributes ) {
attrs [ options . attributeNamePrefix + attrName ] = true ;
}
}
}
if ( ! Object . keys ( attrs ) . length ) {
return ;
}
if ( options . attrNodeName ) {
var attrCollection = { } ;
attrCollection [ options . attrNodeName ] = attrs ;
return attrCollection ;
}
return attrs ;
}
}
exports . getTraversalObj = getTraversalObj ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
module . exports = function ( tagname , parent , val ) {
this . tagname = tagname ;
this . parent = parent ;
this . child = { } ;
this . attrsMap = { } ;
this . children = [ ] ;
this . val = val ;
this . addChild = function ( child ) {
this . children . push ( child ) ;
if ( Array . isArray ( this . child [ child . tagname ] ) ) {
this . child [ child . tagname ] . push ( child ) ;
} else {
this . child [ child . tagname ] = [ child ] ;
}
} ;
} ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
"use strict" ;
var util = __webpack_require__ ( 12 ) ;
var defaultOptions = {
allowBooleanAttributes : false ,
localeRange : 'a-zA-Z'
} ;
var props = [ 'allowBooleanAttributes' , 'localeRange' ] ;
exports . validate = function ( xmlData , options ) {
options = util . buildOptions ( options , defaultOptions , props ) ;
var tags = [ ] ;
var tagFound = false ;
if ( xmlData [ 0 ] === "\uFEFF" ) {
xmlData = xmlData . substr ( 1 ) ;
}
var regxAttrName = new RegExp ( '^[_w][\\w\\-.:]*$' . replace ( '_w' , '_' + options . localeRange ) ) ;
var regxTagName = new RegExp ( '^([w]|_)[\\w.\\-_:]*' . replace ( '([w' , '([' + options . localeRange ) ) ;
for ( var i = 0 ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === '<' ) {
i ++ ;
if ( xmlData [ i ] === '?' ) {
i = readPI ( xmlData , ++ i ) ;
if ( i . err ) {
return i ;
}
} else if ( xmlData [ i ] === '!' ) {
i = readCommentAndCDATA ( xmlData , i ) ;
continue ;
} else {
var closingTag = false ;
if ( xmlData [ i ] === '/' ) {
closingTag = true ;
i ++ ;
}
var tagName = '' ;
for ( ; i < xmlData . length && xmlData [ i ] !== '>' && xmlData [ i ] !== ' ' && xmlData [ i ] !== '\t' && xmlData [ i ] !== '\n' && xmlData [ i ] !== '\r' ; i ++ ) {
tagName += xmlData [ i ] ;
}
tagName = tagName . trim ( ) ;
if ( tagName [ tagName . length - 1 ] === '/' ) {
tagName = tagName . substring ( 0 , tagName . length - 1 ) ;
continue ;
}
if ( ! validateTagName ( tagName , regxTagName ) ) {
return {
err : {
code : 'InvalidTag' ,
msg : 'Tag ' + tagName + ' is an invalid name.'
}
} ;
}
var result = readAttributeStr ( xmlData , i ) ;
if ( result === false ) {
return {
err : {
code : 'InvalidAttr' ,
msg : 'Attributes for "' + tagName + '" have open quote.'
}
} ;
}
var attrStr = result . value ;
i = result . index ;
if ( attrStr [ attrStr . length - 1 ] === '/' ) {
attrStr = attrStr . substring ( 0 , attrStr . length - 1 ) ;
var isValid = validateAttributeString ( attrStr , options , regxAttrName ) ;
if ( isValid === true ) {
tagFound = true ;
} else {
return isValid ;
}
} else if ( closingTag ) {
if ( ! result . tagClosed ) {
return {
err : {
code : 'InvalidTag' ,
msg : 'closing tag "' + tagName + "\" don't have proper closing."
}
} ;
} else if ( attrStr . trim ( ) . length > 0 ) {
return {
err : {
code : 'InvalidTag' ,
msg : 'closing tag "' + tagName + "\" can't have attributes or invalid starting."
}
} ;
} else {
var otg = tags . pop ( ) ;
if ( tagName !== otg ) {
return {
err : {
code : 'InvalidTag' ,
msg : 'closing tag ' + otg + ' is expected inplace of ' + tagName + '.'
}
} ;
}
}
} else {
var _isValid = validateAttributeString ( attrStr , options , regxAttrName ) ;
if ( _isValid !== true ) {
return _isValid ;
}
tags . push ( tagName ) ;
tagFound = true ;
}
for ( i ++ ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === '<' ) {
if ( xmlData [ i + 1 ] === '!' ) {
i ++ ;
i = readCommentAndCDATA ( xmlData , i ) ;
continue ;
} else {
break ;
}
}
}
if ( xmlData [ i ] === '<' ) {
i -- ;
}
}
} else {
if ( xmlData [ i ] === ' ' || xmlData [ i ] === '\t' || xmlData [ i ] === '\n' || xmlData [ i ] === '\r' ) {
continue ;
}
return {
err : {
code : 'InvalidChar' ,
msg : 'char ' + xmlData [ i ] + ' is not expected .'
}
} ;
}
}
if ( ! tagFound ) {
return {
err : {
code : 'InvalidXml' ,
msg : 'Start tag expected.'
}
} ;
} else if ( tags . length > 0 ) {
return {
err : {
code : 'InvalidXml' ,
msg : 'Invalid ' + JSON . stringify ( tags , null , 4 ) . replace ( /\r?\n/g , '' ) + ' found.'
}
} ;
}
return true ;
} ;
function readPI ( xmlData , i ) {
var start = i ;
for ( ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] == '?' || xmlData [ i ] == ' ' ) {
var tagname = xmlData . substr ( start , i - start ) ;
if ( i > 5 && tagname === 'xml' ) {
return {
err : {
code : 'InvalidXml' ,
msg : 'XML declaration allowed only at the start of the document.'
}
} ;
} else if ( xmlData [ i ] == '?' && xmlData [ i + 1 ] == '>' ) {
i ++ ;
break ;
} else {
continue ;
}
}
}
return i ;
}
function readCommentAndCDATA ( xmlData , i ) {
if ( xmlData . length > i + 5 && xmlData [ i + 1 ] === '-' && xmlData [ i + 2 ] === '-' ) {
for ( i += 3 ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === '-' && xmlData [ i + 1 ] === '-' && xmlData [ i + 2 ] === '>' ) {
i += 2 ;
break ;
}
}
} else if ( xmlData . length > i + 8 && xmlData [ i + 1 ] === 'D' && xmlData [ i + 2 ] === 'O' && xmlData [ i + 3 ] === 'C' && xmlData [ i + 4 ] === 'T' && xmlData [ i + 5 ] === 'Y' && xmlData [ i + 6 ] === 'P' && xmlData [ i + 7 ] === 'E' ) {
var angleBracketsCount = 1 ;
for ( i += 8 ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === '<' ) {
angleBracketsCount ++ ;
} else if ( xmlData [ i ] === '>' ) {
angleBracketsCount -- ;
if ( angleBracketsCount === 0 ) {
break ;
}
}
}
} else if ( xmlData . length > i + 9 && xmlData [ i + 1 ] === '[' && xmlData [ i + 2 ] === 'C' && xmlData [ i + 3 ] === 'D' && xmlData [ i + 4 ] === 'A' && xmlData [ i + 5 ] === 'T' && xmlData [ i + 6 ] === 'A' && xmlData [ i + 7 ] === '[' ) {
for ( i += 8 ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === ']' && xmlData [ i + 1 ] === ']' && xmlData [ i + 2 ] === '>' ) {
i += 2 ;
break ;
}
}
}
return i ;
}
var doubleQuote = '"' ;
var singleQuote = "'" ;
function readAttributeStr ( xmlData , i ) {
var attrStr = '' ;
var startChar = '' ;
var tagClosed = false ;
for ( ; i < xmlData . length ; i ++ ) {
if ( xmlData [ i ] === doubleQuote || xmlData [ i ] === singleQuote ) {
if ( startChar === '' ) {
startChar = xmlData [ i ] ;
} else if ( startChar !== xmlData [ i ] ) {
continue ;
} else {
startChar = '' ;
}
} else if ( xmlData [ i ] === '>' ) {
if ( startChar === '' ) {
tagClosed = true ;
break ;
}
}
attrStr += xmlData [ i ] ;
}
if ( startChar !== '' ) {
return false ;
}
return {
value : attrStr ,
index : i ,
tagClosed : tagClosed
} ;
}
var validAttrStrRegxp = new RegExp ( '(\\s*)([^\\s=]+)(\\s*=)?(\\s*([\'"])(([\\s\\S])*?)\\5)?' , 'g' ) ;
function validateAttributeString ( attrStr , options , regxAttrName ) {
var matches = util . getAllMatches ( attrStr , validAttrStrRegxp ) ;
var attrNames = { } ;
for ( var i = 0 ; i < matches . length ; i ++ ) {
if ( matches [ i ] [ 1 ] . length === 0 ) {
return {
err : {
code : 'InvalidAttr' ,
msg : 'attribute ' + matches [ i ] [ 2 ] + ' has no space in starting.'
}
} ;
} else if ( matches [ i ] [ 3 ] === undefined && ! options . allowBooleanAttributes ) {
return {
err : {
code : 'InvalidAttr' ,
msg : 'boolean attribute ' + matches [ i ] [ 2 ] + ' is not allowed.'
}
} ;
}
var attrName = matches [ i ] [ 2 ] ;
if ( ! validateAttrName ( attrName , regxAttrName ) ) {
return {
err : {
code : 'InvalidAttr' ,
msg : 'attribute ' + attrName + ' is an invalid name.'
}
} ;
}
if ( ! Object . prototype . hasOwnProperty . call ( attrNames , attrName ) ) {
attrNames [ attrName ] = 1 ;
} else {
return {
err : {
code : 'InvalidAttr' ,
msg : 'attribute ' + attrName + ' is repeated.'
}
} ;
}
}
return true ;
}
function validateAttrName ( attrName , regxAttrName ) {
return util . doesMatch ( attrName , regxAttrName ) ;
}
function validateTagName ( tagname , regxTagName ) {
return ! util . doesNotMatch ( tagname , regxTagName ) ;
}
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return BitMapFont ; } ) ;
var _imageManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 5 ) ;
var _pool__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 6 ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
var bitMapPool = new _pool__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ( 'bitMapPool' ) ;
var Emitter = __webpack_require__ ( 8 ) ;
var BitMapFont = function ( ) {
function BitMapFont ( name , src , config ) {
var _this = this ;
_classCallCheck ( this , BitMapFont ) ;
var cache = bitMapPool . get ( name ) ;
if ( cache ) {
return cache ;
}
this . config = config ;
this . chars = this . parseConfig ( config ) ;
this . ready = false ;
this . event = new Emitter ( ) ;
this . texture = _imageManager__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] . loadImage ( src , function ( texture , fromCache ) {
if ( fromCache ) {
_this . texture = texture ;
}
_this . ready = true ;
_this . event . emit ( 'text__load__done' ) ;
} ) ;
bitMapPool . set ( name , this ) ;
}
_createClass ( BitMapFont , [ {
key : "parseConfig" ,
value : function parseConfig ( fntText ) {
fntText = fntText . split ( '\r\n' ) . join ( '\n' ) ;
var lines = fntText . split ( '\n' ) ;
var linesParsed = lines . map ( function ( line ) {
return line . trim ( ) . split ( ' ' ) ;
} ) ;
var charsLine = this . getConfigByLineName ( linesParsed , 'chars' ) ;
var charsCount = this . getConfigByKeyInOneLine ( charsLine . line , 'count' ) ;
var commonLine = this . getConfigByLineName ( linesParsed , 'common' ) ;
this . lineHeight = this . getConfigByKeyInOneLine ( commonLine . line , 'lineHeight' ) ;
var infoLine = this . getConfigByLineName ( linesParsed , 'info' ) ;
this . fontSize = this . getConfigByKeyInOneLine ( infoLine . line , 'size' ) ;
var kerningsLine = this . getConfigByLineName ( linesParsed , 'kernings' ) ;
var kerningsCount = 0 ;
var kerningsStart = - 1 ;
if ( kerningsLine . line ) {
kerningsCount = this . getConfigByKeyInOneLine ( kerningsLine . line , 'count' ) ;
kerningsStart = kerningsLine . index + 1 ;
}
var chars = { } ;
for ( var i = 4 ; i < 4 + charsCount ; i ++ ) {
var charText = lines [ i ] ;
var letter = String . fromCharCode ( this . getConfigByKeyInOneLine ( charText , 'id' ) ) ;
var c = { } ;
chars [ letter ] = c ;
c . x = this . getConfigByKeyInOneLine ( charText , 'x' ) ;
c . y = this . getConfigByKeyInOneLine ( charText , 'y' ) ;
c . w = this . getConfigByKeyInOneLine ( charText , 'width' ) ;
c . h = this . getConfigByKeyInOneLine ( charText , 'height' ) ;
c . offX = this . getConfigByKeyInOneLine ( charText , 'xoffset' ) ;
c . offY = this . getConfigByKeyInOneLine ( charText , 'yoffset' ) ;
c . xadvance = this . getConfigByKeyInOneLine ( charText , 'xadvance' ) ;
c . kerning = { } ;
}
if ( kerningsCount ) {
for ( var _i = kerningsStart ; _i <= kerningsStart + kerningsCount ; _i ++ ) {
var line = linesParsed [ _i ] ;
var first = String . fromCharCode ( this . getConfigByKeyInOneLine ( line , 'first' ) ) ;
var second = String . fromCharCode ( this . getConfigByKeyInOneLine ( line , 'second' ) ) ;
var amount = this . getConfigByKeyInOneLine ( line , 'amount' ) ;
if ( chars [ second ] ) {
chars [ second ] . kerning [ first ] = amount ;
}
}
}
return chars ;
}
} , {
key : "getConfigByLineName" ,
value : function getConfigByLineName ( linesParsed ) {
var lineName = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : '' ;
var index = - 1 ;
var line = null ;
var len = linesParsed . length ;
for ( var i = 0 ; i < len ; i ++ ) {
var item = linesParsed [ i ] ;
if ( item [ 0 ] === lineName ) {
index = i ;
line = item ;
}
}
return {
line : line ,
index : index
} ;
}
} , {
key : "getConfigByKeyInOneLine" ,
value : function getConfigByKeyInOneLine ( configText , key ) {
var itemConfigTextList = Array . isArray ( configText ) ? configText : configText . split ( ' ' ) ;
for ( var i = 0 , length = itemConfigTextList . length ; i < length ; i ++ ) {
var itemConfigText = itemConfigTextList [ i ] ;
if ( key === itemConfigText . substring ( 0 , key . length ) ) {
var value = itemConfigText . substring ( key . length + 1 ) ;
return parseInt ( value ) ;
}
}
return 0 ;
}
} ] ) ;
return BitMapFont ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return DebugInfo ; } ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
var DebugInfo = function ( ) {
function DebugInfo ( ) {
_classCallCheck ( this , DebugInfo ) ;
this . reset ( ) ;
}
_createClass ( DebugInfo , [ {
key : "start" ,
value : function start ( name ) {
var isInner = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : false ;
if ( this . totalStart === 0 ) {
this . totalStart = Date . now ( ) ;
}
this . info [ name ] = {
start : Date . now ( ) ,
isInner : isInner
} ;
}
} , {
key : "end" ,
value : function end ( name ) {
if ( this . info [ name ] ) {
this . info [ name ] . end = Date . now ( ) ;
this . info [ name ] . cost = this . info [ name ] . end - this . info [ name ] . start ;
this . totalCost = this . info [ name ] . end - this . totalStart ;
}
}
} , {
key : "reset" ,
value : function reset ( ) {
this . info = { } ;
this . totalStart = 0 ;
this . totalCost = 0 ;
}
} , {
key : "log" ,
value : function log ( ) {
var _this = this ;
var needInner = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : false ;
console . log ( this . info ) ;
var logInfo = 'Layout debug info: \n' ;
logInfo += Object . keys ( this . info ) . reduce ( function ( sum , curr ) {
if ( _this . info [ curr ] . isInner && ! needInner ) {
return sum ;
}
sum += "" . concat ( curr , ": " ) . concat ( _this . info [ curr ] . cost , "\n" ) ;
return sum ;
} , '' ) ;
logInfo += "totalCost: " . concat ( this . totalCost , "\n" ) ;
return logInfo ;
}
} ] ) ;
return DebugInfo ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Ticker ; } ) ;
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
var Ticker = function ( ) {
function Ticker ( ) {
var _this = this ;
_classCallCheck ( this , Ticker ) ;
this . count = 0 ;
this . started = false ;
this . animationId = null ;
this . cbs = [ ] ;
this . nextCbs = [ ] ;
this . innerCbs = [ ] ;
this . update = function ( ) {
_this . cbs . forEach ( function ( cb ) {
cb ( ) ;
} ) ;
_this . innerCbs . forEach ( function ( cb ) {
cb ( ) ;
} ) ;
if ( _this . nextCbs . length ) {
_this . nextCbs . forEach ( function ( cb ) {
return cb ( ) ;
} ) ;
_this . nextCbs = [ ] ;
}
_this . count += 1 ;
_this . animationId = requestAnimationFrame ( _this . update ) ;
} ;
}
_createClass ( Ticker , [ {
key : "cancelIfNeed" ,
value : function cancelIfNeed ( ) {
if ( this . animationId !== null ) {
cancelAnimationFrame ( this . animationId ) ;
this . animationId = null ;
}
}
} , {
key : "add" ,
value : function add ( cb ) {
var isInner = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : false ;
if ( typeof cb === 'function' && this . cbs . indexOf ( cb ) === - 1 ) {
isInner ? this . innerCbs . push ( cb ) : this . cbs . push ( cb ) ;
}
}
} , {
key : "next" ,
value : function next ( cb ) {
if ( typeof cb === 'function' ) {
this . nextCbs . push ( cb ) ;
}
}
} , {
key : "remove" ,
value : function remove ( cb ) {
var isInner = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : false ;
if ( cb === undefined ) {
this . cbs = [ ] ;
this . innerCbs = [ ] ;
this . nextCbs = [ ] ;
}
if ( typeof cb === 'function' && this . cbs . indexOf ( cb ) > - 1 ) {
var list = isInner ? this . innerCbs : this . cbs ;
list . splice ( this . cbs . indexOf ( cb ) , 1 ) ;
}
if ( ! this . cbs . length && ! this . innerCbs . length ) {
this . cancelIfNeed ( ) ;
}
}
} , {
key : "start" ,
value : function start ( ) {
if ( ! this . started ) {
this . started = true ;
if ( this . animationId === null && ( this . cbs . length || this . innerCbs . length ) ) {
this . animationId = requestAnimationFrame ( this . update ) ;
}
}
}
} , {
key : "stop" ,
value : function stop ( ) {
if ( this . started ) {
this . started = false ;
this . cancelIfNeed ( ) ;
}
}
} ] ) ;
return Ticker ;
} ( ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "create" , function ( ) { return create ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "renderChildren" , function ( ) { return renderChildren ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "layoutChildren" , function ( ) { return layoutChildren ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "iterateTree" , function ( ) { return iterateTree ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "repaintChildren" , function ( ) { return repaintChildren ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "repaintTree" , function ( ) { return repaintTree ; } ) ;
__webpack_require__ . d ( __webpack_exports__ , "clone" , function ( ) { return clone ; } ) ;
var _components_index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 20 ) ;
var constructorMap = {
view : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "View" ] ,
text : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "Text" ] ,
image : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "Image" ] ,
scrollview : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "ScrollView" ] ,
bitmaptext : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "BitMapText" ] ,
canvas : _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "Canvas" ]
} ;
function isPercent ( data ) {
return typeof data === 'string' && /\d+(?:\.\d+)?%/ . test ( data ) ;
}
function convertPercent ( data , parentData ) {
if ( typeof data === 'number' ) {
return data ;
}
var matchData = data . match ( /(\d+(?:\.\d+)?)%/ ) [ 1 ] ;
if ( matchData ) {
return parentData * matchData * 0.01 ;
q ;
}
}
function create ( node , style , parent ) {
var _this = this ;
var Constructor = constructorMap [ node . name ] ;
var children = node . children || [ ] ;
var attr = node . attr || { } ;
var dataset = { } ;
var id = attr . id || '' ;
var args = Object . keys ( attr ) . reduce ( function ( obj , key ) {
var value = attr [ key ] ;
var attribute = key ;
if ( key === 'id' ) {
obj . style = Object . assign ( obj . style || { } , style [ id ] || { } ) ;
return obj ;
}
if ( key === 'class' ) {
obj . style = value . split ( /\s+/ ) . reduce ( function ( res , oneClass ) {
return Object . assign ( res , style [ oneClass ] ) ;
} , obj . style || { } ) ;
return obj ;
}
if ( value === 'true' ) {
obj [ attribute ] = true ;
} else if ( value === 'false' ) {
obj [ attribute ] = false ;
} else {
obj [ attribute ] = value ;
}
if ( attribute . startsWith ( 'data-' ) ) {
var dataKey = attribute . substring ( 5 ) ;
dataset [ dataKey ] = value ;
}
obj . dataset = dataset ;
return obj ;
} , { } ) ;
args . idName = id ;
this . eleCount += 1 ;
args . id = this . eleCount ;
args . className = attr [ "class" ] || '' ;
var thisStyle = args . style ;
if ( thisStyle ) {
var parentStyle ;
if ( parent ) {
parentStyle = parent . style ;
} else if ( typeof sharedCanvas !== 'undefined' ) {
parentStyle = sharedCanvas ;
} else if ( typeof __env !== 'undefined' ) {
parentStyle = __env . getSharedCanvas ( ) ;
} else {
parentStyle = {
width : 300 ,
height : 150
} ;
}
if ( isPercent ( thisStyle . width ) ) {
thisStyle . width = parentStyle . width ? convertPercent ( thisStyle . width , parentStyle . width ) : 0 ;
}
if ( isPercent ( thisStyle . height ) ) {
thisStyle . height = parentStyle . height ? convertPercent ( thisStyle . height , parentStyle . height ) : 0 ;
}
}
var element = new Constructor ( args ) ;
element . root = this ;
element . tagName = node . name ;
children . forEach ( function ( childNode ) {
var childElement = create . call ( _this , childNode , style , args ) ;
element . add ( childElement ) ;
} ) ;
return element ;
}
function renderChildren ( children , context ) {
var needRender = arguments . length > 2 && arguments [ 2 ] !== undefined ? arguments [ 2 ] : true ;
children . forEach ( function ( child ) {
child . shouldUpdate = false ;
child . isDirty = false ;
child . insert ( context , needRender ) ;
return renderChildren ( child . children , context , child . type === 'ScrollView' ? false : needRender ) ;
} ) ;
}
function layoutChildren ( element ) {
var _this2 = this ;
element . children . forEach ( function ( child ) {
child . layoutBox = child . layoutBox || { } ;
[ 'left' , 'top' , 'width' , 'height' ] . forEach ( function ( prop ) {
child . layoutBox [ prop ] = child . layout [ prop ] ;
} ) ;
if ( child . parent ) {
child . layoutBox . absoluteX = ( child . parent . layoutBox . absoluteX || 0 ) + child . layoutBox . left ;
child . layoutBox . absoluteY = ( child . parent . layoutBox . absoluteY || 0 ) + child . layoutBox . top ;
} else {
child . layoutBox . absoluteX = child . layoutBox . left ;
child . layoutBox . absoluteY = child . layoutBox . top ;
}
child . layoutBox . originalAbsoluteY = child . layoutBox . absoluteY ;
child . layoutBox . originalAbsoluteX = child . layoutBox . absoluteX ;
layoutChildren . call ( _this2 , child ) ;
} ) ;
}
function none ( ) { }
function iterateTree ( element ) {
var callback = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : none ;
callback ( element ) ;
element . children . forEach ( function ( child ) {
iterateTree ( child , callback ) ;
} ) ;
}
var repaintChildren = function repaintChildren ( children ) {
children . forEach ( function ( child ) {
child . repaint ( ) ;
if ( child . type !== 'ScrollView' ) {
repaintChildren ( child . children ) ;
}
} ) ;
} ;
var repaintTree = function repaintTree ( tree ) {
tree . repaint ( ) ;
tree . children . forEach ( function ( child ) {
child . repaint ( ) ;
repaintTree ( child ) ;
} ) ;
} ;
function clone ( element ) {
var _this3 = this ;
var deep = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : true ;
var parent = arguments . length > 2 ? arguments [ 2 ] : undefined ;
var Constructor = constructorMap [ element . tagName ] ;
this . eleCount += 1 ;
var args = {
style : Object . assign ( { } , element . style ) ,
idName : element . idName ,
className : element . className ,
id : this . eleCount ,
dataset : Object . assign ( { } , element . dataset )
} ;
if ( element instanceof _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "Image" ] ) {
args . src = element . src ;
} else if ( element instanceof _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "Text" ] || element instanceof _components_index_js__WEBPACK_IMPORTED_MODULE_0__ [ "BitMapText" ] ) {
args . value = element . value ;
}
var newElemenet = new Constructor ( args ) ;
newElemenet . root = this ;
newElemenet . insert ( this . renderContext , false ) ;
newElemenet . observeStyleAndEvent ( ) ;
if ( parent ) {
parent . add ( newElemenet ) ;
}
if ( deep ) {
element . children . forEach ( function ( child ) {
clone . call ( _this3 , child , deep , newElemenet ) ;
} ) ;
}
return newElemenet ;
}
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
var _view_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 21 ) ;
__webpack_require__ . d ( __webpack_exports__ , "View" , function ( ) { return _view_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ; } ) ;
var _image_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 22 ) ;
__webpack_require__ . d ( __webpack_exports__ , "Image" , function ( ) { return _image_js__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ; } ) ;
var _text_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__ ( 23 ) ;
__webpack_require__ . d ( __webpack_exports__ , "Text" , function ( ) { return _text_js__WEBPACK_IMPORTED_MODULE_2__ [ "default" ] ; } ) ;
var _scrollview_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__ ( 24 ) ;
__webpack_require__ . d ( __webpack_exports__ , "ScrollView" , function ( ) { return _scrollview_js__WEBPACK_IMPORTED_MODULE_3__ [ "default" ] ; } ) ;
var _bitmaptext_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__ ( 28 ) ;
__webpack_require__ . d ( __webpack_exports__ , "BitMapText" , function ( ) { return _bitmaptext_js__WEBPACK_IMPORTED_MODULE_4__ [ "default" ] ; } ) ;
var _canvas_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__ ( 29 ) ;
__webpack_require__ . d ( __webpack_exports__ , "Canvas" , function ( ) { return _canvas_js__WEBPACK_IMPORTED_MODULE_5__ [ "default" ] ; } ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return View ; } ) ;
var _elements_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 2 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var View = function ( _Element ) {
_inherits ( View , _Element ) ;
var _super = _createSuper ( View ) ;
function View ( _ref ) {
var _this ;
var _ref$style = _ref . style ,
style = _ref$style === void 0 ? { } : _ref$style ,
_ref$idName = _ref . idName ,
idName = _ref$idName === void 0 ? '' : _ref$idName ,
_ref$className = _ref . className ,
className = _ref$className === void 0 ? '' : _ref$className ,
dataset = _ref . dataset ;
_classCallCheck ( this , View ) ;
_this = _super . call ( this , {
idName : idName ,
className : className ,
style : style ,
dataset : dataset
} ) ;
_this . type = 'View' ;
_this . ctx = null ;
return _this ;
}
_createClass ( View , [ {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . isDestroyed = true ;
this . children = null ;
this . root = null ;
}
} , {
key : "checkNeedRender" ,
value : function checkNeedRender ( ) {
var style = this . style || { } ;
var borderColor = style . borderColor ;
return ! ! ( style . backgroundColor || style . borderWidth && borderColor || style . borderTopWidth && ( borderColor || style . borderTopColor ) || style . borderBottomWidth && ( borderColor || style . borderBottomColor ) || style . borderLeftWidth && ( borderColor || style . borderLeftColor ) || style . borderRightWidth && ( borderColor || style . borderRightColor ) ) ;
}
} , {
key : "render" ,
value : function render ( ) {
var style = this . style || { } ;
var box = this . layoutBox ;
var ctx = this . ctx ;
ctx . save ( ) ;
var borderWidth = style . borderWidth || 0 ;
var drawX = box . absoluteX ;
var drawY = box . absoluteY ;
var borderLeftWidth = style . borderLeftWidth || borderWidth ;
var borderRightWidth = style . borderRightWidth || borderWidth ;
var borderTopWidth = style . borderTopWidth || borderWidth ;
var borderBottomWidth = style . borderBottomWidth || borderWidth ;
var _this$renderBorder = this . renderBorder ( ctx ) ,
needClip = _this$renderBorder . needClip ,
needStroke = _this$renderBorder . needStroke ;
if ( needClip ) {
ctx . clip ( ) ;
}
if ( style . backgroundColor ) {
ctx . fillStyle = style . backgroundColor ;
ctx . fillRect ( drawX + borderLeftWidth , drawY + borderRightWidth , box . width - ( borderLeftWidth + borderRightWidth ) , box . height - ( borderTopWidth + borderBottomWidth ) ) ;
}
if ( style . backgroundImage && this . backgroundImage ) {
ctx . drawImage ( this . backgroundImage , drawX , drawY , box . width , box . height ) ;
}
if ( needStroke ) {
ctx . stroke ( ) ;
}
ctx . restore ( ) ;
}
} , {
key : "repaint" ,
value : function repaint ( ) {
this . render ( ) ;
}
} ] ) ;
return View ;
} ( _elements_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Image ; } ) ;
var _elements_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 2 ) ;
var _common_imageManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 5 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var Image = function ( _Element ) {
_inherits ( Image , _Element ) ;
var _super = _createSuper ( Image ) ;
function Image ( opts ) {
var _this ;
_classCallCheck ( this , Image ) ;
var _opts$style = opts . style ,
style = _opts$style === void 0 ? { } : _opts$style ,
_opts$idName = opts . idName ,
idName = _opts$idName === void 0 ? '' : _opts$idName ,
_opts$className = opts . className ,
className = _opts$className === void 0 ? '' : _opts$className ,
_opts$src = opts . src ,
src = _opts$src === void 0 ? '' : _opts$src ,
dataset = opts . dataset ;
_this = _super . call ( this , {
idName : idName ,
className : className ,
dataset : dataset ,
style : style
} ) ;
_this . imgsrc = src ;
Object . defineProperty ( _assertThisInitialized ( _this ) , 'src' , {
get : function get ( ) {
return this . imgsrc ;
} ,
set : function set ( newValue ) {
var _this2 = this ;
if ( newValue !== this . imgsrc ) {
this . imgsrc = newValue ;
_common_imageManager__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] . loadImage ( this . src , function ( img ) {
if ( ! _this2 . isDestroyed ) {
_this2 . img = img ;
_this2 . root . emit ( 'repaint' ) ;
}
} ) ;
}
} ,
enumerable : true ,
configurable : true
} ) ;
_this . type = 'Image' ;
_this . img = _common_imageManager__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] . loadImage ( _this . src , function ( img , fromCache ) {
if ( fromCache ) {
_this . img = img ;
} else {
if ( ! _this . isDestroyed ) {
_this . img = img ;
_this . root . emit ( 'repaint' ) ;
}
}
} ) ;
return _this ;
}
_createClass ( Image , [ {
key : "repaint" ,
value : function repaint ( ) {
this . render ( ) ;
}
} , {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . isDestroyed = true ;
this . img = null ;
delete this . src ;
this . root = null ;
}
} , {
key : "render" ,
value : function render ( ) {
if ( ! this . img || ! this . img . loadDone ) {
return ;
}
var style = this . style || { } ;
var box = this . layoutBox ;
var ctx = this . ctx ;
ctx . save ( ) ;
if ( style . borderColor ) {
ctx . strokeStyle = style . borderColor ;
}
ctx . lineWidth = style . borderWidth || 0 ;
var drawX = box . absoluteX ;
var drawY = box . absoluteY ;
var _this$renderBorder = this . renderBorder ( ctx ) ,
needClip = _this$renderBorder . needClip ,
needStroke = _this$renderBorder . needStroke ;
if ( needClip ) {
ctx . clip ( ) ;
}
if ( style . backgroundColor ) {
ctx . fillStyle = style . backgroundColor ;
ctx . fillRect ( drawX , drawY , box . width , box . height ) ;
}
if ( style . backgroundImage && this . backgroundImage ) {
ctx . drawImage ( this . backgroundImage , drawX , drawY , box . width , box . height ) ;
}
ctx . drawImage ( this . img , drawX , drawY , box . width , box . height ) ;
if ( needStroke ) {
ctx . stroke ( ) ;
}
ctx . restore ( ) ;
}
} ] ) ;
return Image ;
} ( _elements_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Text ; } ) ;
var _elements_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 2 ) ;
var _common_util_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 7 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var DEFAULT_FONT_FAMILY = 'PingFangSC-Regular, sans-serif' ;
var context = null ;
var getContext = function getContext ( ) {
if ( context ) {
return context ;
}
var canvas = Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_1__ [ "createCanvas" ] ) ( ) ;
canvas . width = 1 ;
canvas . height = 1 ;
context = canvas . getContext ( '2d' ) ;
return context ;
} ;
function getTextWidth ( style , value ) {
var context = getContext ( ) ;
context . font = "" . concat ( style . fontWeight || 'normal' , " " ) . concat ( style . fontSize || 12 , "px " ) . concat ( style . fontFamily || DEFAULT_FONT_FAMILY ) ;
return context . measureText ( value ) . width || 0 ;
}
function getTextWidthWithoutSetFont ( value ) {
return getContext ( ) . measureText ( value ) . width || 0 ;
}
function parseText ( style , value ) {
value = String ( value ) ;
var maxWidth = style . width ;
var wordWidth = getTextWidth ( style , value ) ;
var textOverflow = style . textOverflow || 'ellipsis' ;
if ( wordWidth <= maxWidth ) {
return value ;
}
if ( textOverflow === 'ellipsis' ) {
maxWidth -= getTextWidthWithoutSetFont ( '...' ) ;
}
var length = value . length - 1 ;
var str = value . substring ( 0 , length ) ;
while ( getTextWidthWithoutSetFont ( str ) > maxWidth && length > 0 ) {
length -= 1 ;
str = value . substring ( 0 , length ) ;
}
return length && textOverflow === 'ellipsis' ? "" . concat ( str , "..." ) : str ;
}
var Text = function ( _Element ) {
_inherits ( Text , _Element ) ;
var _super = _createSuper ( Text ) ;
function Text ( _ref ) {
var _this ;
var _ref$style = _ref . style ,
style = _ref$style === void 0 ? { } : _ref$style ,
_ref$idName = _ref . idName ,
idName = _ref$idName === void 0 ? '' : _ref$idName ,
_ref$className = _ref . className ,
className = _ref$className === void 0 ? '' : _ref$className ,
_ref$value = _ref . value ,
value = _ref$value === void 0 ? '' : _ref$value ,
dataset = _ref . dataset ;
_classCallCheck ( this , Text ) ;
if ( style . width === undefined ) {
style . width = getTextWidth ( style , value ) ;
} else if ( style . textOverflow === 'ellipsis' ) {
value = parseText ( style , value ) ;
}
_this = _super . call ( this , {
idName : idName ,
className : className ,
style : style ,
dataset : dataset
} ) ;
_this . type = 'Text' ;
_this . ctx = null ;
_this . valuesrc = value ;
Object . defineProperty ( _assertThisInitialized ( _this ) , 'value' , {
get : function get ( ) {
return this . valuesrc ;
} ,
set : function set ( newValue ) {
if ( newValue !== this . valuesrc ) {
this . valuesrc = newValue ;
this . root . emit ( 'repaint' ) ;
}
} ,
enumerable : true ,
configurable : true
} ) ;
return _this ;
}
_createClass ( Text , [ {
key : "toCanvasData" ,
value : function toCanvasData ( ) {
var style = this . style || { } ;
this . fontSize = style . fontSize || 12 ;
this . textBaseline = 'top' ;
this . font = "" . concat ( style . fontWeight || '' , " " ) . concat ( style . fontSize || 12 , "px " ) . concat ( DEFAULT_FONT_FAMILY ) ;
this . textAlign = style . textAlign || 'left' ;
this . fillStyle = style . color || '#000' ;
}
} , {
key : "repaint" ,
value : function repaint ( ) {
this . render ( ) ;
}
} , {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . root = null ;
}
} , {
key : "insert" ,
value : function insert ( ctx , needRender ) {
this . ctx = ctx ;
this . toCanvasData ( ) ;
if ( needRender ) {
this . render ( ) ;
}
}
} , {
key : "render" ,
value : function render ( ) {
var ctx = this . ctx ;
ctx . save ( ) ;
var box = this . layoutBox ;
var style = this . style ;
ctx . textBaseline = this . textBaseline ;
ctx . font = this . font ;
ctx . textAlign = this . textAlign ;
var drawX = box . absoluteX ;
var drawY = box . absoluteY ;
var _this$renderBorder = this . renderBorder ( ctx ) ,
needClip = _this$renderBorder . needClip ,
needStroke = _this$renderBorder . needStroke ;
if ( needClip ) {
ctx . clip ( ) ;
}
if ( style . backgroundColor ) {
ctx . fillStyle = style . backgroundColor ;
ctx . fillRect ( drawX , drawY , box . width , box . height ) ;
}
if ( style . backgroundImage && this . backgroundImage ) {
ctx . drawImage ( this . backgroundImage , drawX , drawY , box . width , box . height ) ;
}
if ( needStroke ) {
ctx . stroke ( ) ;
}
ctx . fillStyle = this . fillStyle ;
if ( this . textAlign === 'center' ) {
drawX += box . width / 2 ;
} else if ( this . textAlign === 'right' ) {
drawX += box . width ;
}
if ( style . lineHeight ) {
ctx . textBaseline = 'middle' ;
drawY += style . lineHeight / 2 ;
}
ctx . fillText ( this . value , drawX , drawY ) ;
ctx . restore ( ) ;
}
} ] ) ;
return Text ;
} ( _elements_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return ScrollView ; } ) ;
var _view_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 21 ) ;
var _common_util_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 7 ) ;
var scroller__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__ ( 25 ) ;
var scroller__WEBPACK_IMPORTED_MODULE_2___default = __webpack_require__ . n ( scroller__WEBPACK_IMPORTED_MODULE_2__ ) ;
var _common_vd_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__ ( 19 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var dpr = Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_1__ [ "getDpr" ] ) ( ) ;
var ScrollView = function ( _View ) {
_inherits ( ScrollView , _View ) ;
var _super = _createSuper ( ScrollView ) ;
function ScrollView ( _ref ) {
var _this ;
var _ref$style = _ref . style ,
style = _ref$style === void 0 ? { } : _ref$style ,
_ref$idName = _ref . idName ,
idName = _ref$idName === void 0 ? '' : _ref$idName ,
_ref$className = _ref . className ,
className = _ref$className === void 0 ? '' : _ref$className ,
scrollX = _ref . scrollX ,
scrollY = _ref . scrollY ,
dataset = _ref . dataset ;
_classCallCheck ( this , ScrollView ) ;
_this = _super . call ( this , {
style : style ,
idName : idName ,
dataset : dataset ,
className : className
} ) ;
_this . type = 'ScrollView' ;
_this . scrollTop = 0 ;
_this . scrollLeft = 0 ;
_this . hasEventBind = false ;
_this . currentEvent = null ;
_this . requestID = null ;
_this . scrollYProp = scrollY ;
_this . innerScrollerOption = {
scrollingX : ! ! scrollX ,
scrollingY : ! ! scrollY
} ;
return _this ;
}
_createClass ( ScrollView , [ {
key : "scrollHeight" ,
get : function get ( ) {
if ( ! this . children . length ) {
return 0 ;
}
var last = this . children [ this . children . length - 1 ] ;
return last . layoutBox . top + last . layoutBox . height ;
}
} , {
key : "scrollWidth" ,
get : function get ( ) {
if ( ! this . children . length ) {
return 0 ;
}
var last = this . children [ this . children . length - 1 ] ;
return last . layoutBox . left + last . layoutBox . width ;
}
} , {
key : "scrollX" ,
get : function get ( ) {
return this . innerScrollerOption . scrollingX ;
} ,
set : function set ( value ) {
this . scrollerOption = {
scrollingX : value
} ;
}
} , {
key : "scrollY" ,
get : function get ( ) {
return this . innerScrollerOption . scrollingY ;
} ,
set : function set ( value ) {
this . scrollerOption = {
scrollingY : value
} ;
}
} , {
key : "scrollerOption" ,
get : function get ( ) {
return this . innerScrollerOption ;
} ,
set : function set ( value ) {
if ( value === void 0 ) {
value = { } ;
}
Object . assign ( this . innerScrollerOption , value ) ;
if ( this . scrollerObj ) {
Object . assign ( this . scrollerObj . options , this . scrollerOption ) ;
}
}
} , {
key : "repaint" ,
value : function repaint ( ) {
this . scrollRender ( this . scrollLeft , this . scrollTop ) ;
}
} , {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . touch = null ;
this . isDestroyed = true ;
this . ctx = null ;
this . children = null ;
this . root . off ( 'touchend' ) ;
this . root = null ;
}
} , {
key : "renderTreeWithTop" ,
value : function renderTreeWithTop ( tree , top , left ) {
var _this2 = this ;
tree . render ( ) ;
tree . children . forEach ( function ( child ) {
_this2 . renderTreeWithTop ( child , top , left ) ;
} ) ;
}
} , {
key : "clear" ,
value : function clear ( ) {
var box = this . layoutBox ;
this . ctx . clearRect ( box . absoluteX , box . absoluteY , box . width , box . height ) ;
}
} , {
key : "scrollRender" ,
value : function scrollRender ( ) {
var _this3 = this ;
var left = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : 0 ;
var top = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : 0 ;
var box = this . layoutBox ;
this . scrollTop = top ;
this . scrollLeft = left ;
var startX = box . absoluteX ,
startY = box . absoluteY ,
width = box . width ,
height = box . height ;
var endX = startX + width ;
var endY = startY + height ;
this . render ( ) ;
this . ctx . save ( ) ;
this . ctx . beginPath ( ) ;
this . ctx . rect ( startX , startY , width , height ) ;
this . ctx . clip ( ) ;
this . children . forEach ( function ( child ) {
var _child$layoutBox = child . layoutBox ,
width = _child$layoutBox . width ,
height = _child$layoutBox . height ,
absoluteX = _child$layoutBox . absoluteX ,
absoluteY = _child$layoutBox . absoluteY ;
if ( absoluteY + height >= startY && absoluteY <= endY && absoluteX + width >= startX && absoluteX <= endX ) {
_this3 . renderTreeWithTop ( child , _this3 . scrollTop , _this3 . scrollLeft ) ;
}
} ) ;
this . ctx . restore ( ) ;
}
} , {
key : "scrollHandler" ,
value : function scrollHandler ( left , top ) {
var _this4 = this ;
if ( ! this . isDestroyed && ! this . isFirstScroll ) {
Object ( _common_vd_js__WEBPACK_IMPORTED_MODULE_3__ [ "iterateTree" ] ) ( this , function ( ele ) {
if ( ele !== _this4 ) {
ele . layoutBox . absoluteY = ele . layoutBox . originalAbsoluteY - top ;
ele . layoutBox . absoluteX = ele . layoutBox . originalAbsoluteX - left ;
}
} ) ;
this . root . emit ( 'repaint' ) ;
if ( this . currentEvent ) {
this . emit ( 'scroll' , this . currentEvent ) ;
}
}
if ( this . isFirstScroll ) {
this . isFirstScroll = false ;
}
}
} , {
key : "insert" ,
value : function insert ( context ) {
var _this5 = this ;
this . ctx = context ;
if ( this . scrollHeight > this . layoutBox . height && typeof this . scrollYProp === 'undefined' ) {
this . scrollY = true ;
}
if ( this . hasEventBind ) {
if ( this . layoutBox . width !== this . scrollerObj . __clientWidth || this . layoutBox . height !== this . scrollerObj . __clientHeight || this . scrollWidth !== this . scrollerObj . __contentWidth || this . scrollHeight !== this . scrollerObj . __contentHeight ) {
this . scrollerObj . setDimensions ( this . layoutBox . width , this . layoutBox . height , this . scrollWidth , this . scrollHeight ) ;
}
Object ( _common_vd_js__WEBPACK_IMPORTED_MODULE_3__ [ "iterateTree" ] ) ( this , function ( ele ) {
if ( ele !== _this5 ) {
ele . layoutBox . absoluteY = ele . layoutBox . originalAbsoluteY - _this5 . scrollTop ;
ele . layoutBox . absoluteX = ele . layoutBox . originalAbsoluteX - _this5 . scrollLeft ;
}
} ) ;
return ;
}
this . hasEventBind = true ;
this . isFirstScroll = true ;
this . scrollerObj = new scroller__WEBPACK_IMPORTED_MODULE_2__ [ "Scroller" ] ( this . scrollHandler . bind ( this ) , this . scrollerOption ) ;
this . scrollerObj . setDimensions ( this . layoutBox . width , this . layoutBox . height , this . scrollWidth , this . scrollHeight ) ;
this . on ( 'touchstart' , function ( e ) {
if ( ! e . touches ) {
e . touches = [ e ] ;
}
var touches = Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_1__ [ "copyTouchArray" ] ) ( e . touches ) ;
touches . forEach ( function ( touch ) {
if ( dpr !== 1 ) {
touch . pageX *= dpr ;
touch . pageY *= dpr ;
}
} ) ;
_this5 . scrollerObj . doTouchStart ( touches , e . timeStamp ) ;
_this5 . currentEvent = e ;
} ) ;
this . on ( 'touchmove' , function ( e ) {
if ( ! e . touches ) {
e . touches = [ e ] ;
}
var touches = Object ( _common_util_js__WEBPACK_IMPORTED_MODULE_1__ [ "copyTouchArray" ] ) ( e . touches ) ;
touches . forEach ( function ( touch ) {
if ( dpr !== 1 ) {
touch . pageX *= dpr ;
touch . pageY *= dpr ;
}
} ) ;
_this5 . scrollerObj . doTouchMove ( touches , e . timeStamp ) ;
_this5 . currentEvent = e ;
} ) ;
this . root . on ( 'touchend' , function ( e ) {
_this5 . scrollerObj . doTouchEnd ( e . timeStamp ) ;
_this5 . currentEvent = e ;
} ) ;
}
} , {
key : "scrollTo" ,
value : function scrollTo ( ) {
var left = arguments . length > 0 && arguments [ 0 ] !== undefined ? arguments [ 0 ] : 0 ;
var top = arguments . length > 1 && arguments [ 1 ] !== undefined ? arguments [ 1 ] : 0 ;
var animate = arguments . length > 2 && arguments [ 2 ] !== undefined ? arguments [ 2 ] : true ;
this . scrollerObj . scrollTo ( left , top , animate ) ;
}
} ] ) ;
return ScrollView ;
} ( _view_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
var __WEBPACK_AMD_DEFINE_FACTORY__ , __WEBPACK_AMD_DEFINE_ARRAY__ , __WEBPACK_AMD_DEFINE_RESULT__ ; ( function ( root , factory ) {
if ( true ) {
! ( __WEBPACK_AMD_DEFINE_ARRAY__ = [ exports , __webpack_require__ ( 26 ) , __webpack_require__ ( 27 ) ] , __WEBPACK_AMD_DEFINE_FACTORY__ = ( factory ) ,
__WEBPACK_AMD_DEFINE_RESULT__ = ( typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
( __WEBPACK_AMD_DEFINE_FACTORY__ . apply ( exports , __WEBPACK_AMD_DEFINE_ARRAY__ ) ) : __WEBPACK_AMD_DEFINE_FACTORY__ ) ,
__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && ( module . exports = __WEBPACK_AMD_DEFINE_RESULT__ ) ) ;
} else { }
} ( this , function ( exports , animate , Scroller ) {
exports . animate = animate ;
exports . Scroller = Scroller ;
} ) ) ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
var __WEBPACK_AMD_DEFINE_FACTORY__ , __WEBPACK_AMD_DEFINE_ARRAY__ , __WEBPACK_AMD_DEFINE_RESULT__ ; /*
 * Scroller
 * http://github.com/zynga/scroller
 *
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/scroller/master/MIT-LICENSE.txt
 *
 * Based on the work of: Unify Project (unify-project.org)
 * http://unify-project.org
 * Copyright 2011, Deutsche Telekom AG
 * License: MIT + Apache (V2)
 */
( function ( root , factory ) {
if ( true ) {
! ( __WEBPACK_AMD_DEFINE_ARRAY__ = [ exports ] , __WEBPACK_AMD_DEFINE_FACTORY__ = ( factory ) ,
__WEBPACK_AMD_DEFINE_RESULT__ = ( typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
( __WEBPACK_AMD_DEFINE_FACTORY__ . apply ( exports , __WEBPACK_AMD_DEFINE_ARRAY__ ) ) : __WEBPACK_AMD_DEFINE_FACTORY__ ) ,
__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && ( module . exports = __WEBPACK_AMD_DEFINE_RESULT__ ) ) ;
} else { }
} ( this , function ( exports ) {
var global = typeof window === 'undefined' ? this : window
var time = Date . now || function ( ) {
return + new Date ( ) ;
} ;
var desiredFrames = 60 ;
var millisecondsPerSecond = 1000 ;
var running = { } ;
var counter = 1 ;
exports . requestAnimationFrame = ( function ( ) {
var requestFrame = global . requestAnimationFrame || global . webkitRequestAnimationFrame || global . mozRequestAnimationFrame || global . oRequestAnimationFrame ;
var isNative = ! ! requestFrame ;
if ( requestFrame && ! /requestAnimationFrame\(\)\s*\{\s*\[native code\]\s*\}/i . test ( requestFrame . toString ( ) ) ) {
isNative = false ;
}
if ( isNative ) {
return function ( callback , root ) {
requestFrame ( callback , root ) ;
} ;
}
var TARGET_FPS = 60 ;
var requests = { } ;
var requestCount = 0 ;
var rafHandle = 1 ;
var intervalHandle = null ;
var lastActive = + new Date ( ) ;
return function ( callback , root ) {
var callbackHandle = rafHandle ++ ;
requests [ callbackHandle ] = callback ;
requestCount ++ ;
if ( intervalHandle === null ) {
intervalHandle = setInterval ( function ( ) {
var time = + new Date ( ) ;
var currentRequests = requests ;
requests = { } ;
requestCount = 0 ;
for ( var key in currentRequests ) {
if ( currentRequests . hasOwnProperty ( key ) ) {
currentRequests [ key ] ( time ) ;
lastActive = time ;
}
}
if ( time - lastActive > 2500 ) {
clearInterval ( intervalHandle ) ;
intervalHandle = null ;
}
} , 1000 / TARGET_FPS ) ;
}
return callbackHandle ;
} ;
} ) ( ) ;
exports . stop = function ( id ) {
var cleared = ( running [ id ] !== null ) ;
if ( cleared ) {
running [ id ] = null ;
}
return cleared ;
} ;
exports . isRunning = function ( id ) {
return running [ id ] !== null ;
} ;
exports . start = function ( stepCallback , verifyCallback , completedCallback , duration , easingMethod , root ) {
var start = time ( ) ;
var lastFrame = start ;
var percent = 0 ;
var dropCounter = 0 ;
var id = counter ++ ;
if ( id % 20 === 0 ) {
var newRunning = { } ;
for ( var usedId in running ) {
newRunning [ usedId ] = true ;
}
running = newRunning ;
}
var step = function ( virtual ) {
var render = virtual !== true ;
var now = time ( ) ;
if ( ! running [ id ] || ( verifyCallback && ! verifyCallback ( id ) ) ) {
running [ id ] = null ;
completedCallback ( desiredFrames - ( dropCounter / ( ( now - start ) / millisecondsPerSecond ) ) , id , false ) ;
return ;
}
if ( render ) {
var droppedFrames = Math . round ( ( now - lastFrame ) / ( millisecondsPerSecond / desiredFrames ) ) - 1 ;
for ( var j = 0 ; j < Math . min ( droppedFrames , 4 ) ; j ++ ) {
step ( true ) ;
dropCounter ++ ;
}
}
if ( duration ) {
percent = ( now - start ) / duration ;
if ( percent > 1 ) {
percent = 1 ;
}
}
var value = easingMethod ? easingMethod ( percent ) : percent ;
if ( ( stepCallback ( value , now , render ) === false || percent === 1 ) && render ) {
running [ id ] = null ;
completedCallback ( desiredFrames - ( dropCounter / ( ( now - start ) / millisecondsPerSecond ) ) , id , percent === 1 || duration === undefined ) ;
} else if ( render ) {
lastFrame = now ;
exports . requestAnimationFrame ( step , root ) ;
}
} ;
running [ id ] = true ;
exports . requestAnimationFrame ( step , root ) ;
return id ;
} ;
} ) ) ;
} ) ,
( function ( module , exports , __webpack_require__ ) {
var __WEBPACK_AMD_DEFINE_FACTORY__ , __WEBPACK_AMD_DEFINE_ARRAY__ , __WEBPACK_AMD_DEFINE_RESULT__ ; /*
 * Scroller
 * http://github.com/zynga/scroller
 *
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/scroller/master/MIT-LICENSE.txt
 *
 * Based on the work of: Unify Project (unify-project.org)
 * http://unify-project.org
 * Copyright 2011, Deutsche Telekom AG
 * License: MIT + Apache (V2)
 */
( function ( root , factory ) {
if ( true ) {
! ( __WEBPACK_AMD_DEFINE_ARRAY__ = [ __webpack_require__ ( 26 ) ] , __WEBPACK_AMD_DEFINE_FACTORY__ = ( factory ) ,
__WEBPACK_AMD_DEFINE_RESULT__ = ( typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
( __WEBPACK_AMD_DEFINE_FACTORY__ . apply ( exports , __WEBPACK_AMD_DEFINE_ARRAY__ ) ) : __WEBPACK_AMD_DEFINE_FACTORY__ ) ,
__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && ( module . exports = __WEBPACK_AMD_DEFINE_RESULT__ ) ) ;
} else { }
} ( this , function ( animate ) {
var NOOP = function ( ) { } ;
var Scroller = function ( callback , options ) {
this . __callback = callback ;
this . options = {
scrollingX : true ,
scrollingY : true ,
animating : true ,
animationDuration : 250 ,
bouncing : true ,
locking : true ,
paging : false ,
snapping : false ,
zooming : false ,
minZoom : 0.5 ,
maxZoom : 3 ,
speedMultiplier : 1 ,
scrollingComplete : NOOP ,
penetrationDeceleration : 0.03 ,
penetrationAcceleration : 0.08
} ;
for ( var key in options ) {
this . options [ key ] = options [ key ] ;
}
} ;
// Open source under the BSD License.
var easeOutCubic = function ( pos ) {
return ( Math . pow ( ( pos - 1 ) , 3 ) + 1 ) ;
} ;
var easeInOutCubic = function ( pos ) {
if ( ( pos /= 0.5 ) < 1 ) {
return 0.5 * Math . pow ( pos , 3 ) ;
}
return 0.5 * ( Math . pow ( ( pos - 2 ) , 3 ) + 2 ) ;
} ;
Scroller . prototype = {
__isSingleTouch : false ,
__isTracking : false ,
__didDecelerationComplete : false ,
__isGesturing : false ,
__isDragging : false ,
__isDecelerating : false ,
__isAnimating : false ,
__clientLeft : 0 ,
__clientTop : 0 ,
__clientWidth : 0 ,
__clientHeight : 0 ,
__contentWidth : 0 ,
__contentHeight : 0 ,
__snapWidth : 100 ,
__snapHeight : 100 ,
__zoomLevel : 1 ,
__scrollLeft : 0 ,
__scrollTop : 0 ,
__maxScrollLeft : 0 ,
__maxScrollTop : 0 ,
__scheduledLeft : 0 ,
__scheduledTop : 0 ,
__scheduledZoom : 0 ,
__lastTouchLeft : null ,
__lastTouchTop : null ,
__lastTouchMove : null ,
__positions : null ,
__minDecelerationScrollLeft : null ,
__minDecelerationScrollTop : null ,
__maxDecelerationScrollLeft : null ,
__maxDecelerationScrollTop : null ,
__decelerationVelocityX : null ,
__decelerationVelocityY : null ,
setDimensions : function ( clientWidth , clientHeight , contentWidth , contentHeight ) {
if ( clientWidth !== null ) {
this . __clientWidth = clientWidth ;
}
if ( clientHeight !== null ) {
this . __clientHeight = clientHeight ;
}
if ( contentWidth !== null ) {
this . __contentWidth = contentWidth ;
}
if ( contentHeight !== null ) {
this . __contentHeight = contentHeight ;
}
this . __computeScrollMax ( ) ;
this . scrollTo ( this . __scrollLeft , this . __scrollTop , true ) ;
} ,
setPosition : function ( left , top ) {
this . __clientLeft = left || 0 ;
this . __clientTop = top || 0 ;
} ,
setSnapSize : function ( width , height ) {
this . __snapWidth = width ;
this . __snapHeight = height ;
} ,
getValues : function ( ) {
return {
left : this . __scrollLeft ,
top : this . __scrollTop ,
right : this . __scrollLeft + this . __clientWidth / this . __zoomLevel ,
bottom : this . __scrollTop + this . __clientHeight / this . __zoomLevel ,
zoom : this . __zoomLevel
} ;
} ,
getPoint : function ( scrollLeft , scrollTop ) {
var values = this . getValues ( ) ;
return {
left : scrollLeft / values . zoom ,
top : scrollTop / values . zoom
} ;
} ,
getScrollMax : function ( ) {
return {
left : this . __maxScrollLeft ,
top : this . __maxScrollTop
} ;
} ,
zoomTo : function ( level , isAnimated , fixedLeft , fixedTop , callback ) {
if ( ! this . options . zooming ) {
throw new Error ( "Zooming is not enabled!" ) ;
}
if ( callback ) {
this . __zoomComplete = callback ;
}
if ( this . __isDecelerating ) {
animate . stop ( this . __isDecelerating ) ;
this . __isDecelerating = false ;
}
var oldLevel = this . __zoomLevel ;
if ( fixedLeft === undefined ) {
fixedLeft = this . __clientWidth / 2 ;
}
if ( fixedTop === undefined ) {
fixedTop = this . __clientHeight / 2 ;
}
level = Math . max ( Math . min ( level , this . options . maxZoom ) , this . options . minZoom ) ;
this . __computeScrollMax ( level ) ;
var k = level / oldLevel ;
var left = k * ( this . __scrollLeft + fixedLeft ) - fixedLeft ;
var top = k * ( this . __scrollTop + fixedTop ) - fixedTop ;
if ( left > this . __maxScrollLeft ) {
left = this . __maxScrollLeft ;
} else if ( left < 0 ) {
left = 0 ;
}
if ( top > this . __maxScrollTop ) {
top = this . __maxScrollTop ;
} else if ( top < 0 ) {
top = 0 ;
}
this . __publish ( left , top , level , isAnimated ) ;
} ,
zoomBy : function ( factor , isAnimated , originLeft , originTop , callback ) {
this . zoomTo ( this . __zoomLevel * factor , isAnimated , originLeft , originTop , callback ) ;
} ,
scrollTo : function ( left , top , isAnimated , zoom ) {
if ( this . __isDecelerating ) {
animate . stop ( this . __isDecelerating ) ;
this . __isDecelerating = false ;
}
if ( zoom !== undefined && zoom !== this . __zoomLevel ) {
if ( ! this . options . zooming ) {
throw new Error ( "Zooming is not enabled!" ) ;
}
left *= zoom ;
top *= zoom ;
this . __computeScrollMax ( zoom ) ;
} else {
zoom = this . __zoomLevel ;
}
if ( ! this . options . scrollingX ) {
left = this . __scrollLeft ;
} else {
if ( this . options . paging ) {
left = Math . round ( left / this . __clientWidth ) * this . __clientWidth ;
} else if ( this . options . snapping ) {
left = Math . round ( left / this . __snapWidth ) * this . __snapWidth ;
}
}
if ( ! this . options . scrollingY ) {
top = this . __scrollTop ;
} else {
if ( this . options . paging ) {
top = Math . round ( top / this . __clientHeight ) * this . __clientHeight ;
} else if ( this . options . snapping ) {
top = Math . round ( top / this . __snapHeight ) * this . __snapHeight ;
}
}
left = Math . max ( Math . min ( this . __maxScrollLeft , left ) , 0 ) ;
top = Math . max ( Math . min ( this . __maxScrollTop , top ) , 0 ) ;
if ( left === this . __scrollLeft && top === this . __scrollTop ) {
isAnimated = false ;
}
this . __publish ( left , top , zoom , isAnimated ) ;
} ,
scrollBy : function ( left , top , isAnimated ) {
var startLeft = this . __isAnimating ? this . __scheduledLeft : this . __scrollLeft ;
var startTop = this . __isAnimating ? this . __scheduledTop : this . __scrollTop ;
this . scrollTo ( startLeft + ( left || 0 ) , startTop + ( top || 0 ) , isAnimated ) ;
} ,
doMouseZoom : function ( wheelDelta , timeStamp , pageX , pageY ) {
var change = wheelDelta > 0 ? 0.97 : 1.03 ;
return this . zoomTo ( this . __zoomLevel * change , false , pageX - this . __clientLeft , pageY - this . __clientTop ) ;
} ,
doTouchStart : function ( touches , timeStamp ) {
if ( touches . length === undefined ) {
throw new Error ( "Invalid touch list: " + touches ) ;
}
if ( timeStamp instanceof Date ) {
timeStamp = timeStamp . valueOf ( ) ;
}
if ( typeof timeStamp !== "number" ) {
throw new Error ( "Invalid timestamp value: " + timeStamp ) ;
}
this . __interruptedAnimation = true ;
if ( this . __isDecelerating ) {
animate . stop ( this . __isDecelerating ) ;
this . __isDecelerating = false ;
this . __interruptedAnimation = true ;
}
if ( this . __isAnimating ) {
animate . stop ( this . __isAnimating ) ;
this . __isAnimating = false ;
this . __interruptedAnimation = true ;
}
var currentTouchLeft , currentTouchTop ;
var isSingleTouch = touches . length === 1 ;
if ( isSingleTouch ) {
currentTouchLeft = touches [ 0 ] . pageX ;
currentTouchTop = touches [ 0 ] . pageY ;
} else {
currentTouchLeft = Math . abs ( touches [ 0 ] . pageX + touches [ 1 ] . pageX ) / 2 ;
currentTouchTop = Math . abs ( touches [ 0 ] . pageY + touches [ 1 ] . pageY ) / 2 ;
}
this . __initialTouchLeft = currentTouchLeft ;
this . __initialTouchTop = currentTouchTop ;
this . __zoomLevelStart = this . __zoomLevel ;
this . __lastTouchLeft = currentTouchLeft ;
this . __lastTouchTop = currentTouchTop ;
this . __lastTouchMove = timeStamp ;
this . __lastScale = 1 ;
this . __enableScrollX = ! isSingleTouch && this . options . scrollingX ;
this . __enableScrollY = ! isSingleTouch && this . options . scrollingY ;
this . __isTracking = true ;
this . __didDecelerationComplete = false ;
this . __isDragging = ! isSingleTouch ;
this . __isSingleTouch = isSingleTouch ;
this . __positions = [ ] ;
} ,
doTouchMove : function ( touches , timeStamp , scale ) {
if ( touches . length === undefined ) {
throw new Error ( "Invalid touch list: " + touches ) ;
}
if ( timeStamp instanceof Date ) {
timeStamp = timeStamp . valueOf ( ) ;
}
if ( typeof timeStamp !== "number" ) {
throw new Error ( "Invalid timestamp value: " + timeStamp ) ;
}
if ( ! this . __isTracking ) {
return ;
}
var currentTouchLeft , currentTouchTop ;
if ( touches . length === 2 ) {
currentTouchLeft = Math . abs ( touches [ 0 ] . pageX + touches [ 1 ] . pageX ) / 2 ;
currentTouchTop = Math . abs ( touches [ 0 ] . pageY + touches [ 1 ] . pageY ) / 2 ;
} else {
currentTouchLeft = touches [ 0 ] . pageX ;
currentTouchTop = touches [ 0 ] . pageY ;
}
var positions = this . __positions ;
if ( this . __isDragging ) {
var moveX = currentTouchLeft - this . __lastTouchLeft ;
var moveY = currentTouchTop - this . __lastTouchTop ;
var scrollLeft = this . __scrollLeft ;
var scrollTop = this . __scrollTop ;
var level = this . __zoomLevel ;
if ( scale !== undefined && this . options . zooming ) {
var oldLevel = level ;
level = level / this . __lastScale * scale ;
level = Math . max ( Math . min ( level , this . options . maxZoom ) , this . options . minZoom ) ;
if ( oldLevel !== level ) {
var currentTouchLeftRel = currentTouchLeft - this . __clientLeft ;
var currentTouchTopRel = currentTouchTop - this . __clientTop ;
scrollLeft = ( ( currentTouchLeftRel + scrollLeft ) * level / oldLevel ) - currentTouchLeftRel ;
scrollTop = ( ( currentTouchTopRel + scrollTop ) * level / oldLevel ) - currentTouchTopRel ;
this . __computeScrollMax ( level ) ;
}
}
if ( this . __enableScrollX ) {
scrollLeft -= moveX * this . options . speedMultiplier ;
var maxScrollLeft = this . __maxScrollLeft ;
if ( scrollLeft > maxScrollLeft || scrollLeft < 0 ) {
if ( this . options . bouncing ) {
scrollLeft += ( moveX / 2 * this . options . speedMultiplier ) ;
} else if ( scrollLeft > maxScrollLeft ) {
scrollLeft = maxScrollLeft ;
} else {
scrollLeft = 0 ;
}
}
}
if ( this . __enableScrollY ) {
scrollTop -= moveY * this . options . speedMultiplier ;
var maxScrollTop = this . __maxScrollTop ;
if ( scrollTop > maxScrollTop || scrollTop < 0 ) {
if ( this . options . bouncing ) {
scrollTop += ( moveY / 2 * this . options . speedMultiplier ) ;
} else if ( scrollTop > maxScrollTop ) {
scrollTop = maxScrollTop ;
} else {
scrollTop = 0 ;
}
}
}
if ( positions . length > 60 ) {
positions . splice ( 0 , 30 ) ;
}
positions . push ( scrollLeft , scrollTop , timeStamp ) ;
this . __publish ( scrollLeft , scrollTop , level ) ;
} else {
var minimumTrackingForScroll = this . options . locking ? 3 : 0 ;
var minimumTrackingForDrag = 5 ;
var distanceX = Math . abs ( currentTouchLeft - this . __initialTouchLeft ) ;
var distanceY = Math . abs ( currentTouchTop - this . __initialTouchTop ) ;
this . __enableScrollX = this . options . scrollingX && distanceX >= minimumTrackingForScroll ;
this . __enableScrollY = this . options . scrollingY && distanceY >= minimumTrackingForScroll ;
positions . push ( this . __scrollLeft , this . __scrollTop , timeStamp ) ;
this . __isDragging = ( this . __enableScrollX || this . __enableScrollY ) && ( distanceX >= minimumTrackingForDrag || distanceY >= minimumTrackingForDrag ) ;
if ( this . __isDragging ) {
this . __interruptedAnimation = false ;
}
}
this . __lastTouchLeft = currentTouchLeft ;
this . __lastTouchTop = currentTouchTop ;
this . __lastTouchMove = timeStamp ;
this . __lastScale = scale ;
} ,
doTouchEnd : function ( timeStamp ) {
if ( timeStamp instanceof Date ) {
timeStamp = timeStamp . valueOf ( ) ;
}
if ( typeof timeStamp !== "number" ) {
throw new Error ( "Invalid timestamp value: " + timeStamp ) ;
}
if ( ! this . __isTracking ) {
return ;
}
this . __isTracking = false ;
if ( this . __isDragging ) {
this . __isDragging = false ;
if ( this . __isSingleTouch && this . options . animating && ( timeStamp - this . __lastTouchMove ) <= 100 ) {
var positions = this . __positions ;
var endPos = positions . length - 1 ;
var startPos = endPos ;
for ( var i = endPos ; i > 0 && positions [ i ] > ( this . __lastTouchMove - 100 ) ; i -= 3 ) {
startPos = i ;
}
if ( startPos !== endPos ) {
var timeOffset = positions [ endPos ] - positions [ startPos ] ;
var movedLeft = this . __scrollLeft - positions [ startPos - 2 ] ;
var movedTop = this . __scrollTop - positions [ startPos - 1 ] ;
this . __decelerationVelocityX = movedLeft / timeOffset * ( 1000 / 60 ) ;
this . __decelerationVelocityY = movedTop / timeOffset * ( 1000 / 60 ) ;
var minVelocityToStartDeceleration = this . options . paging || this . options . snapping ? 4 : 1 ;
if ( Math . abs ( this . __decelerationVelocityX ) > minVelocityToStartDeceleration || Math . abs ( this . __decelerationVelocityY ) > minVelocityToStartDeceleration ) {
this . __startDeceleration ( timeStamp ) ;
}
} else {
this . options . scrollingComplete ( ) ;
}
} else if ( ( timeStamp - this . __lastTouchMove ) > 100 ) {
this . options . scrollingComplete ( ) ;
}
}
if ( ! this . __isDecelerating ) {
if ( this . __interruptedAnimation || this . __isDragging ) {
this . options . scrollingComplete ( ) ;
}
this . scrollTo ( this . __scrollLeft , this . __scrollTop , true , this . __zoomLevel ) ;
}
this . __positions . length = 0 ;
} ,
__publish : function ( left , top , zoom , isAnimated ) {
var wasAnimating = this . __isAnimating ;
if ( wasAnimating ) {
animate . stop ( wasAnimating ) ;
this . __isAnimating = false ;
}
if ( isAnimated && this . options . animating ) {
this . __scheduledLeft = left ;
this . __scheduledTop = top ;
this . __scheduledZoom = zoom ;
var oldLeft = this . __scrollLeft ;
var oldTop = this . __scrollTop ;
var oldZoom = this . __zoomLevel ;
var diffLeft = left - oldLeft ;
var diffTop = top - oldTop ;
var diffZoom = zoom - oldZoom ;
var step = function ( percent , now , render ) {
if ( render ) {
this . __scrollLeft = oldLeft + ( diffLeft * percent ) ;
this . __scrollTop = oldTop + ( diffTop * percent ) ;
this . __zoomLevel = oldZoom + ( diffZoom * percent ) ;
if ( this . __callback ) {
this . __callback ( this . __scrollLeft , this . __scrollTop , this . __zoomLevel ) ;
}
}
} . bind ( this ) ;
var verify = function ( id ) {
return this . __isAnimating === id ;
} . bind ( this ) ;
var completed = function ( renderedFramesPerSecond , animationId , wasFinished ) {
if ( animationId === this . __isAnimating ) {
this . __isAnimating = false ;
}
if ( this . __didDecelerationComplete || wasFinished ) {
this . options . scrollingComplete ( ) ;
}
if ( this . options . zooming ) {
this . __computeScrollMax ( ) ;
if ( this . __zoomComplete ) {
this . __zoomComplete ( ) ;
this . __zoomComplete = null ;
}
}
} . bind ( this ) ;
this . __isAnimating = animate . start ( step , verify , completed , this . options . animationDuration , wasAnimating ? easeOutCubic : easeInOutCubic ) ;
} else {
this . __scheduledLeft = this . __scrollLeft = left ;
this . __scheduledTop = this . __scrollTop = top ;
this . __scheduledZoom = this . __zoomLevel = zoom ;
if ( this . __callback ) {
this . __callback ( left , top , zoom ) ;
}
if ( this . options . zooming ) {
this . __computeScrollMax ( ) ;
if ( this . __zoomComplete ) {
this . __zoomComplete ( ) ;
this . __zoomComplete = null ;
}
}
}
} ,
__computeScrollMax : function ( zoomLevel ) {
if ( zoomLevel === undefined ) {
zoomLevel = this . __zoomLevel ;
}
this . __maxScrollLeft = Math . max ( this . __contentWidth * zoomLevel - this . __clientWidth , 0 ) ;
this . __maxScrollTop = Math . max ( this . __contentHeight * zoomLevel - this . __clientHeight , 0 ) ;
} ,
__startDeceleration : function ( timeStamp ) {
if ( this . options . paging ) {
var scrollLeft = Math . max ( Math . min ( this . __scrollLeft , this . __maxScrollLeft ) , 0 ) ;
var scrollTop = Math . max ( Math . min ( this . __scrollTop , this . __maxScrollTop ) , 0 ) ;
var clientWidth = this . __clientWidth ;
var clientHeight = this . __clientHeight ;
this . __minDecelerationScrollLeft = Math . floor ( scrollLeft / clientWidth ) * clientWidth ;
this . __minDecelerationScrollTop = Math . floor ( scrollTop / clientHeight ) * clientHeight ;
this . __maxDecelerationScrollLeft = Math . ceil ( scrollLeft / clientWidth ) * clientWidth ;
this . __maxDecelerationScrollTop = Math . ceil ( scrollTop / clientHeight ) * clientHeight ;
} else {
this . __minDecelerationScrollLeft = 0 ;
this . __minDecelerationScrollTop = 0 ;
this . __maxDecelerationScrollLeft = this . __maxScrollLeft ;
this . __maxDecelerationScrollTop = this . __maxScrollTop ;
}
var step = function ( percent , now , render ) {
this . __stepThroughDeceleration ( render ) ;
} . bind ( this ) ;
var minVelocityToKeepDecelerating = this . options . snapping ? 4 : 0.1 ;
var verify = function ( ) {
var shouldContinue = Math . abs ( this . __decelerationVelocityX ) >= minVelocityToKeepDecelerating || Math . abs ( this . __decelerationVelocityY ) >= minVelocityToKeepDecelerating ;
if ( ! shouldContinue ) {
this . __didDecelerationComplete = true ;
}
return shouldContinue ;
} . bind ( this ) ;
var completed = function ( renderedFramesPerSecond , animationId , wasFinished ) {
this . __isDecelerating = false ;
if ( this . __didDecelerationComplete ) {
this . options . scrollingComplete ( ) ;
}
this . scrollTo ( this . __scrollLeft , this . __scrollTop , this . options . snapping ) ;
} . bind ( this ) ;
this . __isDecelerating = animate . start ( step , verify , completed ) ;
} ,
__stepThroughDeceleration : function ( render ) {
var scrollLeft = this . __scrollLeft + this . __decelerationVelocityX ;
var scrollTop = this . __scrollTop + this . __decelerationVelocityY ;
if ( ! this . options . bouncing ) {
var scrollLeftFixed = Math . max ( Math . min ( this . __maxDecelerationScrollLeft , scrollLeft ) , this . __minDecelerationScrollLeft ) ;
if ( scrollLeftFixed !== scrollLeft ) {
scrollLeft = scrollLeftFixed ;
this . __decelerationVelocityX = 0 ;
}
var scrollTopFixed = Math . max ( Math . min ( this . __maxDecelerationScrollTop , scrollTop ) , this . __minDecelerationScrollTop ) ;
if ( scrollTopFixed !== scrollTop ) {
scrollTop = scrollTopFixed ;
this . __decelerationVelocityY = 0 ;
}
}
if ( render ) {
this . __publish ( scrollLeft , scrollTop , this . __zoomLevel ) ;
} else {
this . __scrollLeft = scrollLeft ;
this . __scrollTop = scrollTop ;
}
if ( ! this . options . paging ) {
var frictionFactor = 0.95 ;
this . __decelerationVelocityX *= frictionFactor ;
this . __decelerationVelocityY *= frictionFactor ;
}
if ( this . options . bouncing ) {
var scrollOutsideX = 0 ;
var scrollOutsideY = 0 ;
var penetrationDeceleration = this . options . penetrationDeceleration ;
var penetrationAcceleration = this . options . penetrationAcceleration ;
if ( scrollLeft < this . __minDecelerationScrollLeft ) {
scrollOutsideX = this . __minDecelerationScrollLeft - scrollLeft ;
} else if ( scrollLeft > this . __maxDecelerationScrollLeft ) {
scrollOutsideX = this . __maxDecelerationScrollLeft - scrollLeft ;
}
if ( scrollTop < this . __minDecelerationScrollTop ) {
scrollOutsideY = this . __minDecelerationScrollTop - scrollTop ;
} else if ( scrollTop > this . __maxDecelerationScrollTop ) {
scrollOutsideY = this . __maxDecelerationScrollTop - scrollTop ;
}
if ( scrollOutsideX !== 0 ) {
if ( scrollOutsideX * this . __decelerationVelocityX <= 0 ) {
this . __decelerationVelocityX += scrollOutsideX * penetrationDeceleration ;
} else {
this . __decelerationVelocityX = scrollOutsideX * penetrationAcceleration ;
}
}
if ( scrollOutsideY !== 0 ) {
if ( scrollOutsideY * this . __decelerationVelocityY <= 0 ) {
this . __decelerationVelocityY += scrollOutsideY * penetrationDeceleration ;
} else {
this . __decelerationVelocityY = scrollOutsideY * penetrationAcceleration ;
}
}
}
}
} ;
return Scroller ;
} ) ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return BitMapText ; } ) ;
var _elements_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 2 ) ;
var _common_pool_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 6 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var bitMapPool = new _common_pool_js__WEBPACK_IMPORTED_MODULE_1__ [ "default" ] ( 'bitMapPool' ) ;
var BitMapText = function ( _Element ) {
_inherits ( BitMapText , _Element ) ;
var _super = _createSuper ( BitMapText ) ;
function BitMapText ( opts ) {
var _this ;
_classCallCheck ( this , BitMapText ) ;
var _opts$style = opts . style ,
style = _opts$style === void 0 ? { } : _opts$style ,
_opts$idName = opts . idName ,
idName = _opts$idName === void 0 ? '' : _opts$idName ,
_opts$className = opts . className ,
className = _opts$className === void 0 ? '' : _opts$className ,
_opts$value = opts . value ,
value = _opts$value === void 0 ? '' : _opts$value ,
_opts$font = opts . font ,
font = _opts$font === void 0 ? '' : _opts$font ,
dataset = opts . dataset ;
_this = _super . call ( this , {
idName : idName ,
className : className ,
style : style ,
dataset : dataset
} ) ;
_this . type = 'BitMapText' ;
_this . ctx = null ;
_this . valuesrc = value ;
Object . defineProperty ( _assertThisInitialized ( _this ) , 'value' , {
get : function get ( ) {
return this . valuesrc ;
} ,
set : function set ( newValue ) {
if ( newValue !== this . valuesrc ) {
this . valuesrc = newValue ;
this . emit ( 'repaint' ) ;
}
} ,
enumerable : true ,
configurable : true
} ) ;
_this . font = bitMapPool . get ( font ) ;
if ( ! _this . font ) {
console . error ( "Missing BitmapFont \"" . concat ( font , "\", please invoke API \"registBitMapFont\" before using \"BitMapText\"" ) ) ;
}
return _this ;
}
_createClass ( BitMapText , [ {
key : "repaint" ,
value : function repaint ( ) {
this . render ( ) ;
}
} , {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . root = null ;
}
} , {
key : "render" ,
value : function render ( ) {
var _this2 = this ;
if ( ! this . font ) {
return ;
}
if ( this . font . ready ) {
this . renderText ( this . ctx ) ;
} else {
this . font . event . on ( 'text__load__done' , function ( ) {
if ( ! _this2 . isDestroyed ) {
_this2 . renderText ( _this2 . ctx ) ;
}
} ) ;
}
}
} , {
key : "getTextBounds" ,
value : function getTextBounds ( ) {
var style = this . style ;
var _style$letterSpacing = style . letterSpacing ,
letterSpacing = _style$letterSpacing === void 0 ? 0 : _style$letterSpacing ;
var width = 0 ;
for ( var i = 0 , len = this . value . length ; i < len ; i ++ ) {
var _char = this . value [ i ] ;
var cfg = this . font . chars [ _char ] ;
if ( cfg ) {
width += cfg . w ;
if ( i < len - 1 ) {
width += letterSpacing ;
}
}
}
return {
width : width ,
height : this . font . lineHeight
} ;
}
} , {
key : "renderText" ,
value : function renderText ( ctx ) {
var bounds = this . getTextBounds ( ) ;
var defaultLineHeight = this . font . lineHeight ;
ctx . save ( ) ;
var _this$renderBorder = this . renderBorder ( ctx ) ,
needClip = _this$renderBorder . needClip ,
needStroke = _this$renderBorder . needStroke ;
if ( needClip ) {
ctx . clip ( ) ;
}
var box = this . layoutBox ;
var style = this . style ;
var width = style . width ,
height = style . height ,
_style$lineHeight = style . lineHeight ,
lineHeight = _style$lineHeight === void 0 ? defaultLineHeight : _style$lineHeight ,
textAlign = style . textAlign ,
verticalAlign = style . verticalAlign ,
_style$letterSpacing2 = style . letterSpacing ,
letterSpacing = _style$letterSpacing2 === void 0 ? 0 : _style$letterSpacing2 ;
var x = box . absoluteX ;
var y = box . absoluteY ;
var scaleY = lineHeight / defaultLineHeight ;
var realWidth = scaleY * bounds . width ;
if ( style . backgroundColor ) {
ctx . fillStyle = style . backgroundColor ;
ctx . fillRect ( x , y , box . width , box . height ) ;
}
if ( style . backgroundImage && this . backgroundImage ) {
ctx . drawImage ( this . backgroundImage , x , y , box . width , box . height ) ;
}
if ( lineHeight < height ) {
if ( verticalAlign === 'middle' ) {
y += ( height - lineHeight ) / 2 ;
} else if ( verticalAlign === 'bottom' ) {
y = y + height - lineHeight ;
}
}
if ( width > realWidth ) {
if ( textAlign === 'center' ) {
x += ( width - realWidth ) / 2 ;
} else if ( textAlign === 'right' ) {
x += width - realWidth ;
}
}
var prevCharCode = null ;
for ( var i = 0 ; i < this . value . length ; i ++ ) {
var _char2 = this . value [ i ] ;
var cfg = this . font . chars [ _char2 ] ;
if ( prevCharCode && cfg . kerning [ prevCharCode ] ) {
x += cfg . kerning [ prevCharCode ] ;
}
if ( cfg ) {
ctx . drawImage ( this . font . texture , cfg . x , cfg . y , cfg . w , cfg . h , x + cfg . offX * scaleY , y + cfg . offY * scaleY , cfg . w * scaleY , cfg . h * scaleY ) ;
x += cfg . xadvance * scaleY + letterSpacing ;
prevCharCode = _char2 ;
}
}
if ( needStroke ) {
ctx . stroke ( ) ;
}
ctx . restore ( ) ;
}
} ] ) ;
return BitMapText ;
} ( _elements_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} ) ,
( function ( module , __webpack_exports__ , __webpack_require__ ) {
"use strict" ;
__webpack_require__ . r ( __webpack_exports__ ) ;
__webpack_require__ . d ( __webpack_exports__ , "default" , function ( ) { return Canvas ; } ) ;
var _elements_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__ ( 2 ) ;
var _common_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__ ( 7 ) ;
function _typeof ( obj ) { "@babel/helpers - typeof" ; if ( typeof Symbol === "function" && typeof Symbol . iterator === "symbol" ) { _typeof = function _typeof ( obj ) { return typeof obj ; } ; } else { _typeof = function _typeof ( obj ) { return obj && typeof Symbol === "function" && obj . constructor === Symbol && obj !== Symbol . prototype ? "symbol" : typeof obj ; } ; } return _typeof ( obj ) ; }
function _classCallCheck ( instance , Constructor ) { if ( ! ( instance instanceof Constructor ) ) { throw new TypeError ( "Cannot call a class as a function" ) ; } }
function _defineProperties ( target , props ) { for ( var i = 0 ; i < props . length ; i ++ ) { var descriptor = props [ i ] ; descriptor . enumerable = descriptor . enumerable || false ; descriptor . configurable = true ; if ( "value" in descriptor ) descriptor . writable = true ; Object . defineProperty ( target , descriptor . key , descriptor ) ; } }
function _createClass ( Constructor , protoProps , staticProps ) { if ( protoProps ) _defineProperties ( Constructor . prototype , protoProps ) ; if ( staticProps ) _defineProperties ( Constructor , staticProps ) ; return Constructor ; }
function _inherits ( subClass , superClass ) { if ( typeof superClass !== "function" && superClass !== null ) { throw new TypeError ( "Super expression must either be null or a function" ) ; } subClass . prototype = Object . create ( superClass && superClass . prototype , { constructor : { value : subClass , writable : true , configurable : true } } ) ; if ( superClass ) _setPrototypeOf ( subClass , superClass ) ; }
function _setPrototypeOf ( o , p ) { _setPrototypeOf = Object . setPrototypeOf || function _setPrototypeOf ( o , p ) { o . __proto__ = p ; return o ; } ; return _setPrototypeOf ( o , p ) ; }
function _createSuper ( Derived ) { var hasNativeReflectConstruct = _isNativeReflectConstruct ( ) ; return function _createSuperInternal ( ) { var Super = _getPrototypeOf ( Derived ) , result ; if ( hasNativeReflectConstruct ) { var NewTarget = _getPrototypeOf ( this ) . constructor ; result = Reflect . construct ( Super , arguments , NewTarget ) ; } else { result = Super . apply ( this , arguments ) ; } return _possibleConstructorReturn ( this , result ) ; } ; }
function _possibleConstructorReturn ( self , call ) { if ( call && ( _typeof ( call ) === "object" || typeof call === "function" ) ) { return call ; } else if ( call !== void 0 ) { throw new TypeError ( "Derived constructors may only return object or undefined" ) ; } return _assertThisInitialized ( self ) ; }
function _assertThisInitialized ( self ) { if ( self === void 0 ) { throw new ReferenceError ( "this hasn't been initialised - super() hasn't been called" ) ; } return self ; }
function _isNativeReflectConstruct ( ) { if ( typeof Reflect === "undefined" || ! Reflect . construct ) return false ; if ( Reflect . construct . sham ) return false ; if ( typeof Proxy === "function" ) return true ; try { Boolean . prototype . valueOf . call ( Reflect . construct ( Boolean , [ ] , function ( ) { } ) ) ; return true ; } catch ( e ) { return false ; } }
function _getPrototypeOf ( o ) { _getPrototypeOf = Object . setPrototypeOf ? Object . getPrototypeOf : function _getPrototypeOf ( o ) { return o . __proto__ || Object . getPrototypeOf ( o ) ; } ; return _getPrototypeOf ( o ) ; }
var Canvas = function ( _Element ) {
_inherits ( Canvas , _Element ) ;
var _super = _createSuper ( Canvas ) ;
function Canvas ( opts ) {
var _this ;
_classCallCheck ( this , Canvas ) ;
var _opts$style = opts . style ,
style = _opts$style === void 0 ? { } : _opts$style ,
_opts$idName = opts . idName ,
idName = _opts$idName === void 0 ? '' : _opts$idName ,
_opts$className = opts . className ,
className = _opts$className === void 0 ? '' : _opts$className ,
dataset = opts . dataset ,
_opts$width = opts . width ,
width = _opts$width === void 0 ? 100 : _opts$width ,
_opts$height = opts . height ,
height = _opts$height === void 0 ? 100 : _opts$height ,
_opts$autoCreateCanva = opts . autoCreateCanvas ,
autoCreateCanvas = _opts$autoCreateCanva === void 0 ? false : _opts$autoCreateCanva ;
_this = _super . call ( this , {
idName : idName ,
className : className ,
dataset : dataset ,
style : style
} ) ;
_this . canvasInstance = null ;
if ( autoCreateCanvas ) {
_this . canvasInstance = Object ( _common_util__WEBPACK_IMPORTED_MODULE_1__ [ "createCanvas" ] ) ( ) ;
_this . canvasInstance . width = Number ( width ) ;
_this . canvasInstance . height = Number ( height ) ;
}
return _this ;
}
_createClass ( Canvas , [ {
key : "canvas" ,
get : function get ( ) {
return this . canvasInstance ;
} ,
set : function set ( cvs ) {
this . canvasInstance = cvs ;
}
} , {
key : "update" ,
value : function update ( ) {
this . root . emit ( 'repaint' ) ;
}
} , {
key : "repaint" ,
value : function repaint ( ) {
this . render ( ) ;
}
} , {
key : "destroySelf" ,
value : function destroySelf ( ) {
this . isDestroyed = true ;
this . root = null ;
this . canvasInstance = null ;
}
} , {
key : "render" ,
value : function render ( ) {
if ( ! this . canvasInstance ) {
return ;
}
var style = this . style || { } ;
var box = this . layoutBox ;
var ctx = this . ctx ;
ctx . save ( ) ;
if ( style . borderColor ) {
ctx . strokeStyle = style . borderColor ;
}
ctx . lineWidth = style . borderWidth || 0 ;
var drawX = box . absoluteX ;
var drawY = box . absoluteY ;
var _this$renderBorder = this . renderBorder ( ctx ) ,
needClip = _this$renderBorder . needClip ,
needStroke = _this$renderBorder . needStroke ;
if ( needClip ) {
ctx . clip ( ) ;
}
if ( style . backgroundColor ) {
ctx . fillStyle = style . backgroundColor ;
ctx . fillRect ( drawX , drawY , box . width , box . height ) ;
}
if ( style . backgroundImage && this . backgroundImage ) {
ctx . drawImage ( this . backgroundImage , drawX , drawY , box . width , box . height ) ;
}
ctx . drawImage ( this . canvasInstance , drawX , drawY , box . width , box . height ) ;
if ( needStroke ) {
ctx . stroke ( ) ;
}
ctx . restore ( ) ;
}
} ] ) ;
return Canvas ;
} ( _elements_js__WEBPACK_IMPORTED_MODULE_0__ [ "default" ] ) ;
} )
] ) ;
