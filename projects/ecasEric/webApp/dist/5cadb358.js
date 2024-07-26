var t=/[$_\p{ID_Start}]/u,e=/[$_\u200C\u200D\p{ID_Continue}]/u;function n(t,e){return(e?/^[\x00-\xFF]*$/:/^[\x00-\x7F]*$/).test(t)}function r(r,s=!1){const i=[];let a=0;for(;a<r.length;){const o=r[a],h=function(t){if(!s)throw new TypeError(t);i.push({type:"INVALID_CHAR",index:a,value:r[a++]})};if("*"!==o)if("+"!==o&&"?"!==o)if("\\"!==o)if("{"!==o)if("}"!==o)if(":"!==o)if("("!==o)i.push({type:"CHAR",index:a,value:r[a++]});else{let t=1,e="",s=a+1,o=!1;if("?"===r[s]){h(`Pattern cannot start with "?" at ${s}`);continue}for(;s<r.length;){if(!n(r[s],!1)){h(`Invalid character '${r[s]}' at ${s}.`),o=!0;break}if("\\"!==r[s]){if(")"===r[s]){if(t--,0===t){s++;break}}else if("("===r[s]&&(t++,"?"!==r[s+1])){h(`Capturing groups are not allowed at ${s}`),o=!0;break}e+=r[s++]}else e+=r[s++]+r[s++]}if(o)continue;if(t){h(`Unbalanced pattern at ${a}`);continue}if(!e){h(`Missing pattern at ${a}`);continue}i.push({type:"PATTERN",index:a,value:e}),a=s}else{let n="",s=a+1;for(;s<r.length;){const i=r.substr(s,1);if(!(s===a+1&&t.test(i)||s!==a+1&&e.test(i)))break;n+=r[s++]}if(!n){h(`Missing parameter name at ${a}`);continue}i.push({type:"NAME",index:a,value:n}),a=s}else i.push({type:"CLOSE",index:a,value:r[a++]});else i.push({type:"OPEN",index:a,value:r[a++]});else i.push({type:"ESCAPED_CHAR",index:a++,value:r[a++]});else i.push({type:"MODIFIER",index:a,value:r[a++]});else i.push({type:"ASTERISK",index:a,value:r[a++]})}return i.push({type:"END",index:a,value:""}),i}function s(t,e={}){const n=r(t),{prefixes:s="./"}=e,a=`[^${i(void 0===e.delimiter?"/#?":e.delimiter)}]+?`,o=[];let h=0,p=0,c="",u=new Set;const f=t=>{if(p<n.length&&n[p].type===t)return n[p++].value},l=()=>{const t=f("MODIFIER");return t||f("ASTERISK")},m=t=>{const e=f(t);if(void 0!==e)return e;const{type:r,index:s}=n[p];throw new TypeError(`Unexpected ${r} at ${s}, expected ${t}`)},d=()=>{let t,e="";for(;t=f("CHAR")||f("ESCAPED_CHAR");)e+=t;return e},g=e.encodePart||(t=>t);for(;p<n.length;){const t=f("CHAR"),e=f("NAME");let n=f("PATTERN");if(e||n||!f("ASTERISK")||(n=".*"),e||n){let r=t||"";-1===s.indexOf(r)&&(c+=r,r=""),c&&(o.push(g(c)),c="");const i=e||h++;if(u.has(i))throw new TypeError(`Duplicate name '${i}'.`);u.add(i),o.push({name:i,prefix:g(r),suffix:"",pattern:n||a,modifier:l()||""});continue}const r=t||f("ESCAPED_CHAR");if(r){c+=r;continue}if(f("OPEN")){const t=d(),e=f("NAME")||"";let n=f("PATTERN")||"";e||n||!f("ASTERISK")||(n=".*");const r=d();m("CLOSE");const s=l()||"";if(!e&&!n&&!s){c+=t;continue}if(!e&&!n&&!t)continue;c&&(o.push(g(c)),c=""),o.push({name:e||(n?h++:""),pattern:e&&!n?a:n,prefix:g(t),suffix:g(r),modifier:s})}else c&&(o.push(g(c)),c=""),m("END")}return o}function i(t){return t.replace(/([.+*?^${}()[\]|/\\])/g,"\\$1")}function a(t){return t&&t.ignoreCase?"ui":"u"}function o(t,e,n={}){const{strict:r=!1,start:s=!0,end:o=!0,encode:h=(t=>t)}=n,p=`[${i(void 0===n.endsWith?"":n.endsWith)}]|$`,c=`[${i(void 0===n.delimiter?"/#?":n.delimiter)}]`;let u=s?"^":"";for(const n of t)if("string"==typeof n)u+=i(h(n));else{const t=i(h(n.prefix)),r=i(h(n.suffix));if(n.pattern)if(e&&e.push(n),t||r)if("+"===n.modifier||"*"===n.modifier){const e="*"===n.modifier?"?":"";u+=`(?:${t}((?:${n.pattern})(?:${r}${t}(?:${n.pattern}))*)${r})${e}`}else u+=`(?:${t}(${n.pattern})${r})${n.modifier}`;else"+"===n.modifier||"*"===n.modifier?u+=`((?:${n.pattern})${n.modifier})`:u+=`(${n.pattern})${n.modifier}`;else u+=`(?:${t}${r})${n.modifier}`}if(o)r||(u+=`${c}?`),u+=n.endsWith?`(?=${p})`:"$";else{const e=t[t.length-1],n="string"==typeof e?c.indexOf(e[e.length-1])>-1:void 0===e;r||(u+=`(?:${c}(?=${p}))?`),n||(u+=`(?=${c}|${p})`)}return new RegExp(u,a(n))}function h(t,e,n){return t instanceof RegExp?function(t,e){if(!e)return t;const n=/\((?:\?<(.*?)>)?(?!\?)/g;let r=0,s=n.exec(t.source);for(;s;)e.push({name:s[1]||r++,prefix:"",suffix:"",modifier:"",pattern:""}),s=n.exec(t.source);return t}(t,e):Array.isArray(t)?function(t,e,n){const r=t.map((t=>h(t,e,n).source));return new RegExp(`(?:${r.join("|")})`,a(n))}(t,e,n):function(t,e,n){return o(s(t,n),e,n)}(t,e,n)}var p={delimiter:"",prefixes:"",sensitive:!0,strict:!0},c={delimiter:".",prefixes:"",sensitive:!0,strict:!0},u={delimiter:"/",prefixes:"/",sensitive:!0,strict:!0};function f(t,e){return t.startsWith(e)?t.substring(e.length,t.length):t}function l(t){return!(!t||t.length<2)&&("["===t[0]||("\\"===t[0]||"{"===t[0])&&"["===t[1])}var m=["ftp","file","http","https","ws","wss"];function d(t){if(!t)return!0;for(const e of m)if(t.test(e))return!0;return!1}function g(t){switch(t){case"ws":case"http":return"80";case"wws":case"https":return"443";case"ftp":return"21";default:return""}}function x(t){if(""===t)return t;if(/^[-+.A-Za-z0-9]*$/.test(t))return t.toLowerCase();throw new TypeError(`Invalid protocol '${t}'.`)}function S(t){if(""===t)return t;const e=new URL("https://example.com");return e.username=t,e.username}function w(t){if(""===t)return t;const e=new URL("https://example.com");return e.password=t,e.password}function k(t){if(""===t)return t;if(/[\t\n\r #%/:<>?@[\]^\\|]/g.test(t))throw new TypeError(`Invalid hostname '${t}'`);const e=new URL("https://example.com");return e.hostname=t,e.hostname}function y(t){if(""===t)return t;if(/[^0-9a-fA-F[\]:]/g.test(t))throw new TypeError(`Invalid IPv6 hostname '${t}'`);return t.toLowerCase()}function P(t){if(""===t)return t;if(/^[0-9]*$/.test(t)&&parseInt(t)<=65535)return t;throw new TypeError(`Invalid port '${t}'.`)}function R(t){if(""===t)return t;const e=new URL("https://example.com");return e.pathname="/"!==t[0]?"/-"+t:t,"/"!==t[0]?e.pathname.substring(2,e.pathname.length):e.pathname}function b(t){if(""===t)return t;return new URL(`data:${t}`).pathname}function $(t){if(""===t)return t;const e=new URL("https://example.com");return e.search=t,e.search.substring(1,e.search.length)}function I(t){if(""===t)return t;const e=new URL("https://example.com");return e.hash=t,e.hash.substring(1,e.hash.length)}var C=class{constructor(t){this.tokenList=[],this.internalResult={},this.tokenIndex=0,this.tokenIncrement=1,this.componentStart=0,this.state=0,this.groupDepth=0,this.hostnameIPv6BracketDepth=0,this.shouldTreatAsStandardURL=!1,this.input=t}get result(){return this.internalResult}parse(){for(this.tokenList=r(this.input,!0);this.tokenIndex<this.tokenList.length;this.tokenIndex+=this.tokenIncrement){if(this.tokenIncrement=1,"END"===this.tokenList[this.tokenIndex].type){if(0===this.state){this.rewind(),this.isHashPrefix()?this.changeState(9,1):this.isSearchPrefix()?(this.changeState(8,1),this.internalResult.hash=""):(this.changeState(7,0),this.internalResult.search="",this.internalResult.hash="");continue}if(2===this.state){this.rewindAndSetState(5);continue}this.changeState(10,0);break}if(this.groupDepth>0){if(!this.isGroupClose())continue;this.groupDepth-=1}if(this.isGroupOpen())this.groupDepth+=1;else switch(this.state){case 0:this.isProtocolSuffix()&&(this.internalResult.username="",this.internalResult.password="",this.internalResult.hostname="",this.internalResult.port="",this.internalResult.pathname="",this.internalResult.search="",this.internalResult.hash="",this.rewindAndSetState(1));break;case 1:if(this.isProtocolSuffix()){this.computeShouldTreatAsStandardURL();let t=7,e=1;this.shouldTreatAsStandardURL&&(this.internalResult.pathname="/"),this.nextIsAuthoritySlashes()?(t=2,e=3):this.shouldTreatAsStandardURL&&(t=2),this.changeState(t,e)}break;case 2:this.isIdentityTerminator()?this.rewindAndSetState(3):(this.isPathnameStart()||this.isSearchPrefix()||this.isHashPrefix())&&this.rewindAndSetState(5);break;case 3:this.isPasswordPrefix()?this.changeState(4,1):this.isIdentityTerminator()&&this.changeState(5,1);break;case 4:this.isIdentityTerminator()&&this.changeState(5,1);break;case 5:this.isIPv6Open()?this.hostnameIPv6BracketDepth+=1:this.isIPv6Close()&&(this.hostnameIPv6BracketDepth-=1),this.isPortPrefix()&&!this.hostnameIPv6BracketDepth?this.changeState(6,1):this.isPathnameStart()?this.changeState(7,0):this.isSearchPrefix()?this.changeState(8,1):this.isHashPrefix()&&this.changeState(9,1);break;case 6:this.isPathnameStart()?this.changeState(7,0):this.isSearchPrefix()?this.changeState(8,1):this.isHashPrefix()&&this.changeState(9,1);break;case 7:this.isSearchPrefix()?this.changeState(8,1):this.isHashPrefix()&&this.changeState(9,1);break;case 8:this.isHashPrefix()&&this.changeState(9,1)}}}changeState(t,e){switch(this.state){case 0:case 2:break;case 1:this.internalResult.protocol=this.makeComponentString();break;case 3:this.internalResult.username=this.makeComponentString();break;case 4:this.internalResult.password=this.makeComponentString();break;case 5:this.internalResult.hostname=this.makeComponentString();break;case 6:this.internalResult.port=this.makeComponentString();break;case 7:this.internalResult.pathname=this.makeComponentString();break;case 8:this.internalResult.search=this.makeComponentString();break;case 9:this.internalResult.hash=this.makeComponentString()}this.changeStateWithoutSettingComponent(t,e)}changeStateWithoutSettingComponent(t,e){this.state=t,this.componentStart=this.tokenIndex+e,this.tokenIndex+=e,this.tokenIncrement=0}rewind(){this.tokenIndex=this.componentStart,this.tokenIncrement=0}rewindAndSetState(t){this.rewind(),this.state=t}safeToken(t){return t<0&&(t=this.tokenList.length-t),t<this.tokenList.length?this.tokenList[t]:this.tokenList[this.tokenList.length-1]}isNonSpecialPatternChar(t,e){const n=this.safeToken(t);return n.value===e&&("CHAR"===n.type||"ESCAPED_CHAR"===n.type||"INVALID_CHAR"===n.type)}isProtocolSuffix(){return this.isNonSpecialPatternChar(this.tokenIndex,":")}nextIsAuthoritySlashes(){return this.isNonSpecialPatternChar(this.tokenIndex+1,"/")&&this.isNonSpecialPatternChar(this.tokenIndex+2,"/")}isIdentityTerminator(){return this.isNonSpecialPatternChar(this.tokenIndex,"@")}isPasswordPrefix(){return this.isNonSpecialPatternChar(this.tokenIndex,":")}isPortPrefix(){return this.isNonSpecialPatternChar(this.tokenIndex,":")}isPathnameStart(){return this.isNonSpecialPatternChar(this.tokenIndex,"/")}isSearchPrefix(){if(this.isNonSpecialPatternChar(this.tokenIndex,"?"))return!0;if("?"!==this.tokenList[this.tokenIndex].value)return!1;const t=this.safeToken(this.tokenIndex-1);return"NAME"!==t.type&&"PATTERN"!==t.type&&"CLOSE"!==t.type&&"ASTERISK"!==t.type}isHashPrefix(){return this.isNonSpecialPatternChar(this.tokenIndex,"#")}isGroupOpen(){return"OPEN"==this.tokenList[this.tokenIndex].type}isGroupClose(){return"CLOSE"==this.tokenList[this.tokenIndex].type}isIPv6Open(){return this.isNonSpecialPatternChar(this.tokenIndex,"[")}isIPv6Close(){return this.isNonSpecialPatternChar(this.tokenIndex,"]")}makeComponentString(){const t=this.tokenList[this.tokenIndex],e=this.safeToken(this.componentStart).index;return this.input.substring(e,t.index)}computeShouldTreatAsStandardURL(){const t={};Object.assign(t,p),t.encodePart=x;const e=h(this.makeComponentString(),void 0,t);this.shouldTreatAsStandardURL=d(e)}},v=["protocol","username","password","hostname","port","pathname","search","hash"],E="*";function L(t,e){if("string"!=typeof t)throw new TypeError("parameter 1 is not of type 'string'.");const n=new URL(t,e);return{protocol:n.protocol.substring(0,n.protocol.length-1),username:n.username,password:n.password,hostname:n.hostname,port:n.port,pathname:n.pathname,search:""!=n.search?n.search.substring(1,n.search.length):void 0,hash:""!=n.hash?n.hash.substring(1,n.hash.length):void 0}}function A(t,e){return e?U(t):t}function T(t,e,n){let r;if("string"==typeof e.baseURL)try{r=new URL(e.baseURL),t.protocol=A(r.protocol.substring(0,r.protocol.length-1),n),t.username=A(r.username,n),t.password=A(r.password,n),t.hostname=A(r.hostname,n),t.port=A(r.port,n),t.pathname=A(r.pathname,n),t.search=A(r.search.substring(1,r.search.length),n),t.hash=A(r.hash.substring(1,r.hash.length),n)}catch{throw new TypeError(`invalid baseURL '${e.baseURL}'.`)}if("string"==typeof e.protocol&&(t.protocol=function(t,e){var n,r;return r=":",t=(n=t).endsWith(r)?n.substr(0,n.length-r.length):n,e||""===t?t:x(t)}(e.protocol,n)),"string"==typeof e.username&&(t.username=function(t,e){if(e||""===t)return t;const n=new URL("https://example.com");return n.username=t,n.username}(e.username,n)),"string"==typeof e.password&&(t.password=function(t,e){if(e||""===t)return t;const n=new URL("https://example.com");return n.password=t,n.password}(e.password,n)),"string"==typeof e.hostname&&(t.hostname=function(t,e){return e||""===t?t:l(t)?y(t):k(t)}(e.hostname,n)),"string"==typeof e.port&&(t.port=function(t,e,n){return g(e)===t&&(t=""),n||""===t?t:P(t)}(e.port,t.protocol,n)),"string"==typeof e.pathname){if(t.pathname=e.pathname,r&&!function(t,e){return!(!t.length||"/"!==t[0]&&(!e||t.length<2||"\\"!=t[0]&&"{"!=t[0]||"/"!=t[1]))}(t.pathname,n)){const e=r.pathname.lastIndexOf("/");e>=0&&(t.pathname=A(r.pathname.substring(0,e+1),n)+t.pathname)}t.pathname=function(t,e,n){if(n||""===t)return t;if(e&&!m.includes(e))return new URL(`${e}:${t}`).pathname;const r="/"==t[0];return t=new URL(r?t:"/-"+t,"https://example.com").pathname,r||(t=t.substring(2,t.length)),t}(t.pathname,t.protocol,n)}return"string"==typeof e.search&&(t.search=function(t,e){if(t=f(t,"?"),e||""===t)return t;const n=new URL("https://example.com");return n.search=t,n.search?n.search.substring(1,n.search.length):""}(e.search,n)),"string"==typeof e.hash&&(t.hash=function(t,e){if(t=f(t,"#"),e||""===t)return t;const n=new URL("https://example.com");return n.hash=t,n.hash?n.hash.substring(1,n.hash.length):""}(e.hash,n)),t}function U(t){return t.replace(/([+*?:{}()\\])/g,"\\$1")}function N(t,e){const n=`[^${r=void 0===e.delimiter?"/#?":e.delimiter,r.replace(/([.+*?^${}()[\]|/\\])/g,"\\$1")}]+?`;var r;const s=/[$_\u200C\u200D\p{ID_Continue}]/u;let i="";for(let r=0;r<t.length;++r){const a=t[r],o=r>0?t[r-1]:null,h=r<t.length-1?t[r+1]:null;if("string"==typeof a){i+=U(a);continue}if(""===a.pattern){if(""===a.modifier){i+=U(a.prefix);continue}i+=`{${U(a.prefix)}}${a.modifier}`;continue}const p="number"!=typeof a.name,c=void 0!==e.prefixes?e.prefixes:"./";let u=""!==a.suffix||""!==a.prefix&&(1!==a.prefix.length||!c.includes(a.prefix));if(!u&&p&&a.pattern===n&&""===a.modifier&&h&&!h.prefix&&!h.suffix)if("string"==typeof h){const t=h.length>0?h[0]:"";u=s.test(t)}else u="number"==typeof h.name;if(!u&&""===a.prefix&&o&&"string"==typeof o&&o.length>0){const t=o[o.length-1];u=c.includes(t)}u&&(i+="{"),i+=U(a.prefix),p&&(i+=`:${a.name}`),".*"===a.pattern?p||o&&"string"!=typeof o&&!o.modifier&&!u&&""===a.prefix?i+="(.*)":i+="*":a.pattern===n?p||(i+=`(${n})`):i+=`(${a.pattern})`,a.pattern===n&&p&&""!==a.suffix&&s.test(a.suffix[0])&&(i+="\\"),i+=U(a.suffix),u&&(i+="}"),i+=a.modifier}return i}var O=class{constructor(t={},e,n){this.regexp={},this.keys={},this.component_pattern={};try{let r;if("string"==typeof e?r=e:n=e,"string"==typeof t){const e=new C(t);if(e.parse(),t=e.result,void 0===r&&"string"!=typeof t.protocol)throw new TypeError("A base URL must be provided for a relative constructor string.");t.baseURL=r}else{if(!t||"object"!=typeof t)throw new TypeError("parameter 1 is not of type 'string' and cannot convert to dictionary.");if(r)throw new TypeError("parameter 1 is not of type 'string'.")}void 0===n&&(n={ignoreCase:!1});const i={ignoreCase:!0===n.ignoreCase},a={pathname:E,protocol:E,username:E,password:E,hostname:E,port:E,search:E,hash:E};let h;for(h of(this.pattern=T(a,t,!0),g(this.pattern.protocol)===this.pattern.port&&(this.pattern.port=""),v)){if(!(h in this.pattern))continue;const t={},e=this.pattern[h];switch(this.keys[h]=[],h){case"protocol":Object.assign(t,p),t.encodePart=x;break;case"username":Object.assign(t,p),t.encodePart=S;break;case"password":Object.assign(t,p),t.encodePart=w;break;case"hostname":Object.assign(t,c),l(e)?t.encodePart=y:t.encodePart=k;break;case"port":Object.assign(t,p),t.encodePart=P;break;case"pathname":d(this.regexp.protocol)?(Object.assign(t,u,i),t.encodePart=R):(Object.assign(t,p,i),t.encodePart=b);break;case"search":Object.assign(t,p,i),t.encodePart=$;break;case"hash":Object.assign(t,p,i),t.encodePart=I}try{const n=s(e,t);this.regexp[h]=o(n,this.keys[h],t),this.component_pattern[h]=N(n,t)}catch{throw new TypeError(`invalid ${h} pattern '${this.pattern[h]}'.`)}}}catch(t){throw new TypeError(`Failed to construct 'URLPattern': ${t.message}`)}}test(t={},e){let n,r={pathname:"",protocol:"",username:"",password:"",hostname:"",port:"",search:"",hash:""};if("string"!=typeof t&&e)throw new TypeError("parameter 1 is not of type 'string'.");if(void 0===t)return!1;try{r=T(r,"object"==typeof t?t:L(t,e),!1)}catch(t){return!1}for(n of v)if(!this.regexp[n].exec(r[n]))return!1;return!0}exec(t={},e){let n={pathname:"",protocol:"",username:"",password:"",hostname:"",port:"",search:"",hash:""};if("string"!=typeof t&&e)throw new TypeError("parameter 1 is not of type 'string'.");if(void 0===t)return;try{n=T(n,"object"==typeof t?t:L(t,e),!1)}catch(t){return null}let r,s={};for(r of(s.inputs=e?[t,e]:[t],v)){let t=this.regexp[r].exec(n[r]);if(!t)return null;let e={};for(let[n,s]of this.keys[r].entries())if("string"==typeof s.name||"number"==typeof s.name){let r=t[n+1];e[s.name]=r}s[r]={input:n[r]||"",groups:e}}return s}get protocol(){return this.component_pattern.protocol}get username(){return this.component_pattern.username}get password(){return this.component_pattern.password}get hostname(){return this.component_pattern.hostname}get port(){return this.component_pattern.port}get pathname(){return this.component_pattern.pathname}get search(){return this.component_pattern.search}get hash(){return this.component_pattern.hash}};globalThis.URLPattern||(globalThis.URLPattern=O);export{O as URLPattern};