(() => {
  // node_modules/@trimjs/web-app/dist/index.js
  function e(t2) {
    return e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e2) {
      return typeof e2;
    } : function(e2) {
      return e2 && "function" == typeof Symbol && e2.constructor === Symbol && e2 !== Symbol.prototype ? "symbol" : typeof e2;
    }, e(t2);
  }
  function t(t2) {
    var r2 = (function(t3, r3) {
      if ("object" != e(t3) || !t3) return t3;
      var n2 = t3[Symbol.toPrimitive];
      if (void 0 !== n2) {
        var i2 = n2.call(t3, r3 || "default");
        if ("object" != e(i2)) return i2;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === r3 ? String : Number)(t3);
    })(t2, "string");
    return "symbol" == e(r2) ? r2 : r2 + "";
  }
  function r(e2, r2, n2) {
    return (r2 = t(r2)) in e2 ? Object.defineProperty(e2, r2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[r2] = n2, e2;
  }
  var n = new class {
    constructor() {
      r(this, "debug", false);
    }
    setDebug(e2) {
      this.debug = e2;
    }
    isDebug() {
      return this.debug;
    }
    log() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.log("[Trim App]", ...t2);
      }
    }
    warn() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.warn("[Trim App]", ...t2);
      }
    }
    error() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.error("[Trim App]", ...t2);
      }
    }
    info() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.info("[Trim App]", ...t2);
      }
    }
  }();
  var i = () => (function(e2) {
    const t2 = /FNOS\/([\d.]+)|FNAppType\/(\w+)|FNAppVer\/([\d.]+)/g, r2 = {};
    let n2;
    for (; null !== (n2 = t2.exec(e2)); ) n2[1] && (r2.fnOSVersion = n2[1]), n2[2] && (r2.fnAppType = n2[2]), n2[3] && (r2.fnAppVersion = n2[3]);
    return r2;
  })(navigator.userAgent).fnAppVersion;
  function o(e2, t2, r2, n2, i2, o2, s2) {
    try {
      var l2 = e2[o2](s2), a2 = l2.value;
    } catch (e3) {
      return void r2(e3);
    }
    l2.done ? t2(a2) : Promise.resolve(a2).then(n2, i2);
  }
  function s(e2) {
    return function() {
      var t2 = this, r2 = arguments;
      return new Promise(function(n2, i2) {
        var s2 = e2.apply(t2, r2);
        function l2(e3) {
          o(s2, n2, i2, l2, a2, "next", e3);
        }
        function a2(e3) {
          o(s2, n2, i2, l2, a2, "throw", e3);
        }
        l2(void 0);
      });
    };
  }
  function l(e2, t2) {
    var r2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var n2 = Object.getOwnPropertySymbols(e2);
      t2 && (n2 = n2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), r2.push.apply(r2, n2);
    }
    return r2;
  }
  function a(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = null != arguments[t2] ? arguments[t2] : {};
      t2 % 2 ? l(Object(n2), true).forEach(function(t3) {
        r(e2, t3, n2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : l(Object(n2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      });
    }
    return e2;
  }
  var u = false;
  window.addEventListener("flutterInAppWebViewPlatformReady", () => {
    u = true;
  });
  var p = /(iPad|iPhone|iPod|Macintosh|Mac OS X)/i.test(navigator.userAgent);
  var c = /* @__PURE__ */ (function() {
    var e2 = s(function* (e3, t2) {
      for (var r2 = arguments.length, i2 = new Array(r2 > 2 ? r2 - 2 : 0), o2 = 2; o2 < r2; o2++) i2[o2 - 2] = arguments[o2];
      n.log(`callHandler: ${t2}, params: ${i2.map((e4) => String(e4)).join(", ")}`);
      const s2 = yield e3.callHandler(t2, ...i2);
      if (s2) try {
        const e4 = JSON.parse(s2);
        n.log(`messageData: ${JSON.stringify(e4)}`);
        const t3 = JSON.parse(e4.result);
        return n.log(`appMessage: ${JSON.stringify(t3)}`), t3;
      } catch (l2) {
        return n.error(`error: ${l2}`), null;
      }
      return null;
    });
    return function(t2, r2) {
      return e2.apply(this, arguments);
    };
  })();
  var d = /* @__PURE__ */ new Map();
  var f = class {
    constructor(e2) {
      r(this, "subscribeFn", void 0), this.subscribeFn = e2;
    }
    subscribe(e2, t2, r2) {
      var n2;
      const i2 = "function" == typeof e2 ? { next: e2, error: t2, complete: r2 } : null != e2 ? e2 : {};
      let o2 = false;
      const s2 = null !== (n2 = this.subscribeFn({ next: (e3) => {
        var t3;
        o2 || (null === (t3 = i2.next) || void 0 === t3 || t3.call(i2, e3));
      }, error: (e3) => {
        var t3;
        o2 || (o2 = true, null === (t3 = i2.error) || void 0 === t3 || t3.call(i2, e3));
      }, complete: () => {
        var e3;
        o2 || (o2 = true, null === (e3 = i2.complete) || void 0 === e3 || e3.call(i2));
      } })) && void 0 !== n2 ? n2 : () => {
      };
      return { unsubscribe: () => {
        o2 || (o2 = true, s2());
      } };
    }
  };
  var h = /* @__PURE__ */ new Map();
  function v() {
    window._flutter_onAppObservableQueryResult = (e2) => {
      n.log("_flutter_onAppObservableQueryResult", e2);
      const t2 = (function(e3) {
        var t3, r3;
        const n2 = "string" == typeof e3 ? JSON.parse(e3) : e3, i2 = null !== (t3 = n2.reqid) && void 0 !== t3 ? t3 : n2.reqId;
        return a(a({}, n2), {}, { reqId: null !== (r3 = n2.reqId) && void 0 !== r3 ? r3 : i2, reqid: i2 });
      })(e2), r2 = h.get(t2.reqId);
      if (r2) if (t2.result && "doing" !== t2.result) {
        if ("succ" === t2.result) return r2.next(t2), r2.complete(), void h.delete(t2.reqId);
        r2.error(t2), h.delete(t2.reqId);
      } else r2.next(t2);
      else n.log("_flutter_onAppObservableQueryResult observer not found", t2);
    };
  }
  function y() {
    return (y = s(function* (e2, t2) {
      return new Promise((r2, i2) => {
        null == e2 || e2.callHandler("openFolder", JSON.stringify(t2)).then((e3) => {
          if (n.log("pickFilePromise callback registered", { reqId: e3, params: t2 }), e3) {
            let o2 = function(e4) {
              r2(e4.result);
            };
            d.set(e3, o2);
          } else i2(/* @__PURE__ */ new Error("openFolder failed"));
        });
      });
    })).apply(this, arguments);
  }
  i() && (window.fnAppMessage = (e2) => {
    n.log("app-message", e2);
    const t2 = JSON.parse(e2), r2 = d.get(t2.reqId);
    r2 && (r2(t2), d.delete(t2.reqId));
  }), i() && v();
  var g = /* @__PURE__ */ (function(e2) {
    return e2.Call = "call", e2.Reply = "reply", e2.Syn = "syn", e2.SynAck = "synAck", e2.Ack = "ack", e2;
  })({});
  var b = /* @__PURE__ */ (function(e2) {
    return e2.Fulfilled = "fulfilled", e2.Rejected = "rejected", e2;
  })({});
  var m = /* @__PURE__ */ (function(e2) {
    return e2.ConnectionDestroyed = "ConnectionDestroyed", e2.ConnectionTimeout = "ConnectionTimeout", e2.NoIframeSrc = "NoIframeSrc", e2;
  })({});
  var w = /* @__PURE__ */ (function(e2) {
    return e2.DataCloneError = "DataCloneError", e2;
  })({});
  var A = /* @__PURE__ */ (function(e2) {
    return e2.Message = "message", e2;
  })({});
  var S = ({ name: e2, message: t2, stack: r2 }) => ({ name: e2, message: t2, stack: r2 });
  var P = (e2, t2, r2) => {
    let { localName: n2, local: i2, remote: o2, originForSending: s2, originForReceiving: l2 } = e2, a2 = false, u2 = (e3) => {
      if (e3.source !== o2 || e3.data.penpal !== g.Call) return;
      if ("*" !== l2 && e3.origin !== l2) return void r2(`${n2} received message from origin ${e3.origin} which did not match expected origin ${l2}`);
      let { methodName: i3, args: u3, id: p2 } = e3.data;
      r2(`${n2}: Received ${i3}() call`);
      let c2 = (e4) => (t3) => {
        if (r2(`${n2}: Sending ${i3}() reply`), a2) return void r2(`${n2}: Unable to send ${i3}() reply due to destroyed connection`);
        let l3 = { penpal: g.Reply, id: p2, resolution: e4, returnValue: t3 };
        e4 === b.Rejected && t3 instanceof Error && (l3.returnValue = S(t3), l3.returnValueIsError = true);
        try {
          o2.postMessage(l3, s2);
        } catch (e5) {
          let r3 = e5 instanceof Error ? e5 : Error(String(e5));
          if (r3.name === w.DataCloneError) {
            let e6 = { penpal: g.Reply, id: p2, resolution: b.Rejected, returnValue: S(r3), returnValueIsError: true };
            o2.postMessage(e6, s2);
          }
          throw e5;
        }
      };
      new Promise((e4) => e4(t2[i3].apply(t2, u3))).then(c2(b.Fulfilled), c2(b.Rejected));
    };
    return i2.addEventListener(A.Message, u2), () => {
      a2 = true, i2.removeEventListener(A.Message, u2);
    };
  };
  var O = 0;
  var M = () => ++O;
  var E = (e2) => e2 ? e2.split(".") : [];
  var F = (e2, t2, r2) => {
    let n2 = E(t2);
    return n2.reduce((e3, t3, i2) => (void 0 === e3[t3] && (e3[t3] = {}), i2 === n2.length - 1 && (e3[t3] = r2), e3[t3]), e2), e2;
  };
  var $ = (e2, t2) => {
    let r2 = {};
    return Object.keys(e2).forEach((n2) => {
      let i2 = e2[n2], o2 = ((e3, t3) => {
        let r3 = E(t3 || "");
        return r3.push(e3), ((e4) => e4.join("."))(r3);
      })(n2, t2);
      "object" == typeof i2 && Object.assign(r2, $(i2, o2)), "function" == typeof i2 && (r2[o2] = i2);
    }), r2;
  };
  var _ = (e2, t2, r2, n2, i2) => {
    let { localName: o2, local: s2, remote: l2, originForSending: a2, originForReceiving: u2 } = t2, p2 = false;
    i2(`${o2}: Connecting call sender`);
    let c2 = (e3) => (...t3) => {
      let r3;
      i2(`${o2}: Sending ${e3}() call`);
      try {
        l2.closed && (r3 = true);
      } catch (g2) {
        r3 = true;
      }
      if (r3 && n2(), p2) {
        let t4 = /* @__PURE__ */ Error(`Unable to send ${e3}() call due to destroyed connection`);
        throw t4.code = m.ConnectionDestroyed, t4;
      }
      return new Promise((r4, n3) => {
        let p3 = M(), c3 = (t4) => {
          if (t4.source !== l2 || t4.data.penpal !== g.Reply || t4.data.id !== p3) return;
          if ("*" !== u2 && t4.origin !== u2) return void i2(`${o2} received message from origin ${t4.origin} which did not match expected origin ${u2}`);
          let a3 = t4.data;
          i2(`${o2}: Received ${e3}() reply`), s2.removeEventListener(A.Message, c3);
          let d4 = a3.returnValue;
          a3.returnValueIsError && (d4 = ((e4) => {
            let t5 = /* @__PURE__ */ Error();
            return Object.assign(t5, e4), t5;
          })(d4)), (a3.resolution === b.Fulfilled ? r4 : n3)(d4);
        };
        s2.addEventListener(A.Message, c3);
        let d3 = { penpal: g.Call, id: p3, methodName: e3, args: t3 };
        l2.postMessage(d3, a2);
      });
    }, d2 = r2.reduce((e3, t3) => (e3[t3] = c2(t3), e3), {});
    return Object.assign(e2, ((e3) => {
      let t3 = {};
      for (let r3 in e3) F(t3, r3, e3[r3]);
      return t3;
    })(d2)), () => {
      p2 = true;
    };
  };
  var j = (e2, t2) => {
    let r2;
    return void 0 !== e2 && (r2 = window.setTimeout(() => {
      let r3 = /* @__PURE__ */ Error(`Connection timed out after ${e2}ms`);
      r3.code = m.ConnectionTimeout, t2(r3);
    }, e2)), () => {
      clearTimeout(r2);
    };
  };
  function k(e2) {
    return k = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && "function" == typeof Symbol && e3.constructor === Symbol && e3 !== Symbol.prototype ? "symbol" : typeof e3;
    }, k(e2);
  }
  function W(e2) {
    var t2 = (function(e3, t3) {
      if ("object" != k(e3) || !e3) return e3;
      var r2 = e3[Symbol.toPrimitive];
      if (void 0 !== r2) {
        var n2 = r2.call(e3, t3 || "default");
        if ("object" != k(n2)) return n2;
        throw TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t3 ? String : Number)(e3);
    })(e2, "string");
    return "symbol" == k(t2) ? t2 : t2 + "";
  }
  function q(e2, t2, r2) {
    return (t2 = W(t2)) in e2 ? Object.defineProperty(e2, t2, { value: r2, enumerable: true, configurable: true, writable: true }) : e2[t2] = r2, e2;
  }
  function x(e2, t2) {
    var r2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var n2 = Object.getOwnPropertySymbols(e2);
      t2 && (n2 = n2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), r2.push.apply(r2, n2);
    }
    return r2;
  }
  function N(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var r2 = null == arguments[t2] ? {} : arguments[t2];
      t2 % 2 ? x(Object(r2), true).forEach(function(t3) {
        q(e2, t3, r2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(r2)) : x(Object(r2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(r2, t3));
      });
    }
    return e2;
  }
  var T = (e2, t2, r2, n2, i2) => {
    let { destroy: o2, onDestroy: s2 } = n2;
    return (n3) => {
      if (!(e2 instanceof RegExp ? e2.test(n3.origin) : "*" === e2 || e2 === n3.origin)) return void i2(`Child: Handshake - Received SYN-ACK from origin ${n3.origin} which did not match expected origin ${e2}`);
      i2("Child: Handshake - Received SYN-ACK, responding with ACK");
      let l2 = "null" === n3.origin ? "*" : n3.origin, a2 = { penpal: g.Ack, methodNames: Object.keys(t2), config: r2 };
      window.parent.postMessage(a2, l2);
      let u2 = { localName: "Child", local: window, remote: window.parent, originForSending: l2, originForReceiving: n3.origin }, p2 = P(u2, t2, i2);
      s2(p2);
      let c2 = {}, d2 = _(c2, u2, n3.data.methodNames, o2, i2);
      return s2(d2), c2;
    };
  };
  function I(e2, t2) {
    var r2;
    null == (r2 = console) || r2.warn(`[fnApp warn]: ${e2}`, t2);
  }
  function C(e2, t2) {
    var r2;
    null == (r2 = console) || r2.error(`[fnApp error]: ${e2}`, t2);
  }
  var V = "_fn_all_event";
  var U = "\u4E8B\u4EF6\u8BA2\u9605\u6570\u91CF\u4E3A\u7A7A";
  function R(e2) {
    return R = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && "function" == typeof Symbol && e3.constructor === Symbol && e3 !== Symbol.prototype ? "symbol" : typeof e3;
    }, R(e2);
  }
  function D(e2) {
    var t2 = (function(e3, t3) {
      if ("object" != R(e3) || !e3) return e3;
      var r2 = e3[Symbol.toPrimitive];
      if (void 0 !== r2) {
        var n2 = r2.call(e3, t3 || "default");
        if ("object" != R(n2)) return n2;
        throw TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t3 ? String : Number)(e3);
    })(e2, "string");
    return "symbol" == R(t2) ? t2 : t2 + "";
  }
  function z(e2, t2, r2) {
    return (t2 = D(t2)) in e2 ? Object.defineProperty(e2, t2, { value: r2, enumerable: true, configurable: true, writable: true }) : e2[t2] = r2, e2;
  }
  var L = window.__POWERED_BY_FNAPP__ ? window.__FNAPP.inject.appEventObjMap : /* @__PURE__ */ new Map();
  var J = class {
    constructor(e2, t2) {
      z(this, "id", void 0), z(this, "appName", void 0), z(this, "eventObj", void 0), z(this, "getEventCallBackLength", (e3) => {
        var t3;
        return (null == (t3 = this.eventObj[e3]) ? void 0 : t3.length) || 0;
      }), this.id = e2, this.appName = t2, this.$clear(), L.get(this.id) || L.set(this.id, {}), this.eventObj = L.get(this.id);
    }
    $on(e2, t2) {
      let r2 = this.eventObj[e2];
      return r2 ? (r2.includes(t2) || r2.push(t2), this) : (this.eventObj[e2] = [t2], this);
    }
    $onAll(e2) {
      return this.$on(V, e2);
    }
    $once(e2, t2) {
      t2.$__once = true, this.$on(e2, t2);
    }
    $off(e2, t2) {
      let r2 = this.eventObj[e2];
      if (!e2 || !r2 || !r2.length) return I(`${e2} ${U}`), this;
      let n2, i2 = r2.length;
      for (; i2--; ) if (n2 = r2[i2], n2 === t2) {
        r2.splice(i2, 1);
        break;
      }
      return this;
    }
    $offAll(e2) {
      return this.$off(V, e2);
    }
    $emit(e2, ...t2) {
      return e2 = `${this.appName}/${e2}`, this.$pureEmit(e2, ...t2);
    }
    $pureEmit(e2, ...t2) {
      let r2 = 0;
      return L.forEach((n2) => {
        if (n2[e2]) for (let i2 = n2[e2].length - 1; i2 >= 0; i2--) {
          r2++;
          let o2 = n2[e2][i2];
          o2.$__once && n2[e2].splice(i2, 1);
          try {
            o2(...t2);
          } catch (e3) {
            C(e3);
          }
        }
        if (n2._fn_all_event) for (let i2 = n2[V].length - 1; i2 >= 0; i2--) {
          r2++;
          let o2 = n2[V][i2];
          o2.$__once && n2[V].splice(i2, 1);
          try {
            o2(...t2);
          } catch (e3) {
            C(e3);
          }
        }
      }), (!e2 || 0 === r2) && I(`${e2} ${U}`), this;
    }
    $clear() {
      var e2;
      let t2 = null == (e2 = L.get(this.id)) ? {} : e2;
      return Object.keys(t2).forEach((e3) => delete t2[e3]), this;
    }
  };
  var H = function(e2, t2) {
    return H = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e3, t3) {
      e3.__proto__ = t3;
    } || function(e3, t3) {
      for (var r2 in t3) Object.prototype.hasOwnProperty.call(t3, r2) && (e3[r2] = t3[r2]);
    }, H(e2, t2);
  };
  function Q(e2, t2) {
    if ("function" != typeof t2 && null !== t2) throw TypeError("Class extends value " + String(t2) + " is not a constructor or null");
    function r2() {
      this.constructor = e2;
    }
    H(e2, t2), e2.prototype = null === t2 ? Object.create(t2) : (r2.prototype = t2.prototype, new r2());
  }
  function B(e2) {
    var t2 = "function" == typeof Symbol && Symbol.iterator, r2 = t2 && e2[t2], n2 = 0;
    if (r2) return r2.call(e2);
    if (e2 && "number" == typeof e2.length) return { next: function() {
      return e2 && n2 >= e2.length && (e2 = void 0), { value: e2 && e2[n2++], done: !e2 };
    } };
    throw TypeError(t2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function Y(e2, t2) {
    var r2 = "function" == typeof Symbol && e2[Symbol.iterator];
    if (!r2) return e2;
    var n2, i2, o2 = r2.call(e2), s2 = [];
    try {
      for (; (void 0 === t2 || t2-- > 0) && !(n2 = o2.next()).done; ) s2.push(n2.value);
    } catch (e3) {
      i2 = { error: e3 };
    } finally {
      try {
        n2 && !n2.done && (r2 = o2.return) && r2.call(o2);
      } finally {
        if (i2) throw i2.error;
      }
    }
    return s2;
  }
  function G(e2, t2, r2) {
    if (r2 || 2 === arguments.length) for (var n2, i2 = 0, o2 = t2.length; i2 < o2; i2++) (n2 || !(i2 in t2)) && (n2 || (n2 = Array.prototype.slice.call(t2, 0, i2)), n2[i2] = t2[i2]);
    return e2.concat(n2 || Array.prototype.slice.call(t2));
  }
  function K(e2) {
    return "function" == typeof e2;
  }
  var X = (function(e2) {
    var t2 = e2(function(e3) {
      Error.call(e3), e3.stack = Error().stack;
    });
    return t2.prototype = Object.create(Error.prototype), t2.prototype.constructor = t2, t2;
  })(function(e2) {
    return function(t2) {
      e2(this), this.message = t2 ? t2.length + " errors occurred during unsubscription:\n" + t2.map(function(e3, t3) {
        return t3 + 1 + ") " + e3.toString();
      }).join("\n  ") : "", this.name = "UnsubscriptionError", this.errors = t2;
    };
  });
  function Z(e2, t2) {
    if (e2) {
      var r2 = e2.indexOf(t2);
      0 <= r2 && e2.splice(r2, 1);
    }
  }
  var ee = (function() {
    function e2(e3) {
      this.initialTeardown = e3, this.closed = false, this._parentage = null, this._finalizers = null;
    }
    return e2.prototype.unsubscribe = function() {
      var e3, t2, r2, n2, i2;
      if (!this.closed) {
        this.closed = true;
        var o2 = this._parentage;
        if (o2) if (this._parentage = null, Array.isArray(o2)) try {
          for (var s2 = B(o2), l2 = s2.next(); !l2.done; l2 = s2.next()) l2.value.remove(this);
        } catch (t3) {
          e3 = { error: t3 };
        } finally {
          try {
            l2 && !l2.done && (t2 = s2.return) && t2.call(s2);
          } finally {
            if (e3) throw e3.error;
          }
        }
        else o2.remove(this);
        var a2 = this.initialTeardown;
        if (K(a2)) try {
          a2();
        } catch (e4) {
          i2 = e4 instanceof X ? e4.errors : [e4];
        }
        var u2 = this._finalizers;
        if (u2) {
          this._finalizers = null;
          try {
            for (var p2 = B(u2), c2 = p2.next(); !c2.done; c2 = p2.next()) {
              var d2 = c2.value;
              try {
                re(d2);
              } catch (e4) {
                i2 = null == i2 ? [] : i2, e4 instanceof X ? i2 = G(G([], Y(i2)), Y(e4.errors)) : i2.push(e4);
              }
            }
          } catch (e4) {
            r2 = { error: e4 };
          } finally {
            try {
              c2 && !c2.done && (n2 = p2.return) && n2.call(p2);
            } finally {
              if (r2) throw r2.error;
            }
          }
        }
        if (i2) throw new X(i2);
      }
    }, e2.prototype.add = function(t2) {
      var r2;
      if (t2 && t2 !== this) if (this.closed) re(t2);
      else {
        if (t2 instanceof e2) {
          if (t2.closed || t2._hasParent(this)) return;
          t2._addParent(this);
        }
        (this._finalizers = null == (r2 = this._finalizers) ? [] : r2).push(t2);
      }
    }, e2.prototype._hasParent = function(e3) {
      var t2 = this._parentage;
      return t2 === e3 || Array.isArray(t2) && t2.includes(e3);
    }, e2.prototype._addParent = function(e3) {
      var t2 = this._parentage;
      this._parentage = Array.isArray(t2) ? (t2.push(e3), t2) : t2 ? [t2, e3] : e3;
    }, e2.prototype._removeParent = function(e3) {
      var t2 = this._parentage;
      t2 === e3 ? this._parentage = null : Array.isArray(t2) && Z(t2, e3);
    }, e2.prototype.remove = function(t2) {
      var r2 = this._finalizers;
      r2 && Z(r2, t2), t2 instanceof e2 && t2._removeParent(this);
    }, e2.EMPTY = (function() {
      var t2 = new e2();
      return t2.closed = true, t2;
    })(), e2;
  })();
  function te(e2) {
    return e2 instanceof ee || e2 && "closed" in e2 && K(e2.remove) && K(e2.add) && K(e2.unsubscribe);
  }
  function re(e2) {
    K(e2) ? e2() : e2.unsubscribe();
  }
  ee.EMPTY;
  var ne = null;
  var ie = null;
  var oe = void 0;
  var se = false;
  var le = false;
  var ae = { setTimeout: function(e2, t2) {
    var r2 = [...arguments].slice(2), n2 = ae.delegate;
    return null != n2 && n2.setTimeout ? n2.setTimeout.apply(n2, G([e2, t2], Y(r2))) : setTimeout.apply(void 0, G([e2, t2], Y(r2)));
  }, clearTimeout: function(e2) {
    var t2 = ae.delegate;
    return ((null == t2 ? void 0 : t2.clearTimeout) || clearTimeout)(e2);
  }, delegate: void 0 };
  function ue() {
  }
  var pe = ce("C", void 0, void 0);
  function ce(e2, t2, r2) {
    return { kind: e2, value: t2, error: r2 };
  }
  var de = null;
  var fe = (function(e2) {
    function t2(t3) {
      var r2 = e2.call(this) || this;
      return r2.isStopped = false, t3 ? (r2.destination = t3, te(t3) && t3.add(r2)) : r2.destination = we, r2;
    }
    return Q(t2, e2), t2.create = function(e3, t3, r2) {
      return new ge(e3, t3, r2);
    }, t2.prototype.next = function(e3) {
      this.isStopped ? me((function(e4) {
        return ce("N", e4, void 0);
      })(e3), this) : this._next(e3);
    }, t2.prototype.error = function(e3) {
      this.isStopped ? me((function(e4) {
        return ce("E", void 0, e4);
      })(e3), this) : (this.isStopped = true, this._error(e3));
    }, t2.prototype.complete = function() {
      this.isStopped ? me(pe, this) : (this.isStopped = true, this._complete());
    }, t2.prototype.unsubscribe = function() {
      this.closed || (this.isStopped = true, e2.prototype.unsubscribe.call(this), this.destination = null);
    }, t2.prototype._next = function(e3) {
      this.destination.next(e3);
    }, t2.prototype._error = function(e3) {
      try {
        this.destination.error(e3);
      } finally {
        this.unsubscribe();
      }
    }, t2.prototype._complete = function() {
      try {
        this.destination.complete();
      } finally {
        this.unsubscribe();
      }
    }, t2;
  })(ee);
  var he = Function.prototype.bind;
  function ve(e2, t2) {
    return he.call(e2, t2);
  }
  var ye = (function() {
    function e2(e3) {
      this.partialObserver = e3;
    }
    return e2.prototype.next = function(e3) {
      var t2 = this.partialObserver;
      if (t2.next) try {
        t2.next(e3);
      } catch (e4) {
        be(e4);
      }
    }, e2.prototype.error = function(e3) {
      var t2 = this.partialObserver;
      if (t2.error) try {
        t2.error(e3);
      } catch (e4) {
        be(e4);
      }
      else be(e3);
    }, e2.prototype.complete = function() {
      var e3 = this.partialObserver;
      if (e3.complete) try {
        e3.complete();
      } catch (e4) {
        be(e4);
      }
    }, e2;
  })();
  var ge = (function(e2) {
    function t2(t3, r2, n2) {
      var i2, o2, s2 = e2.call(this) || this;
      K(t3) || !t3 ? i2 = { next: null == t3 ? void 0 : t3, error: null == r2 ? void 0 : r2, complete: null == n2 ? void 0 : n2 } : s2 && le ? ((o2 = Object.create(t3)).unsubscribe = function() {
        return s2.unsubscribe();
      }, i2 = { next: t3.next && ve(t3.next, o2), error: t3.error && ve(t3.error, o2), complete: t3.complete && ve(t3.complete, o2) }) : i2 = t3;
      return s2.destination = new ye(i2), s2;
    }
    return Q(t2, e2), t2;
  })(fe);
  function be(e2) {
    se ? (function(e3) {
      se && de && (de.errorThrown = true, de.error = e3);
    })(e2) : (function(e3) {
      ae.setTimeout(function() {
        if (!ne) throw e3;
        ne(e3);
      });
    })(e2);
  }
  function me(e2, t2) {
    var r2 = ie;
    r2 && ae.setTimeout(function() {
      return r2(e2, t2);
    });
  }
  var we = { closed: true, next: ue, error: function(e2) {
    throw e2;
  }, complete: ue };
  var Ae = "function" == typeof Symbol && Symbol.observable || "@@observable";
  function Se(e2) {
    return e2;
  }
  var Pe = (function() {
    function e2(e3) {
      e3 && (this._subscribe = e3);
    }
    return e2.prototype.lift = function(t2) {
      var r2 = new e2();
      return r2.source = this, r2.operator = t2, r2;
    }, e2.prototype.subscribe = function(e3, t2, r2) {
      var n2 = this, i2 = (function(e4) {
        return e4 && e4 instanceof fe || (function(e5) {
          return e5 && K(e5.next) && K(e5.error) && K(e5.complete);
        })(e4) && te(e4);
      })(e3) ? e3 : new ge(e3, t2, r2);
      return (function(e4) {
        if (se) {
          var t3 = !de;
          if (t3 && (de = { errorThrown: false, error: null }), e4(), t3) {
            var r3 = de, n3 = r3.errorThrown, i3 = r3.error;
            if (de = null, n3) throw i3;
          }
        } else e4();
      })(function() {
        var e4 = n2, t3 = e4.operator, r3 = e4.source;
        i2.add(t3 ? t3.call(i2, r3) : r3 ? n2._subscribe(i2) : n2._trySubscribe(i2));
      }), i2;
    }, e2.prototype._trySubscribe = function(e3) {
      try {
        return this._subscribe(e3);
      } catch (b2) {
        e3.error(b2);
      }
    }, e2.prototype.forEach = function(e3, t2) {
      var r2 = this;
      return new (t2 = Oe(t2))(function(t3, n2) {
        var i2 = new ge({ next: function(t4) {
          try {
            e3(t4);
          } catch (e4) {
            n2(e4), i2.unsubscribe();
          }
        }, error: n2, complete: t3 });
        r2.subscribe(i2);
      });
    }, e2.prototype._subscribe = function(e3) {
      var t2;
      return null == (t2 = this.source) ? void 0 : t2.subscribe(e3);
    }, e2.prototype[Ae] = function() {
      return this;
    }, e2.prototype.pipe = function() {
      return (function(e3) {
        return 0 === e3.length ? Se : 1 === e3.length ? e3[0] : function(t2) {
          return e3.reduce(function(e4, t3) {
            return t3(e4);
          }, t2);
        };
      })([...arguments])(this);
    }, e2.prototype.toPromise = function(e3) {
      var t2 = this;
      return new (e3 = Oe(e3))(function(e4, r2) {
        var n2;
        t2.subscribe(function(e5) {
          return n2 = e5;
        }, function(e5) {
          return r2(e5);
        }, function() {
          return e4(n2);
        });
      });
    }, e2.create = function(t2) {
      return new e2(t2);
    }, e2;
  })();
  function Oe(e2) {
    var t2;
    return null == (t2 = null == e2 ? oe : e2) ? Promise : t2;
  }
  function Me(e2, t2, r2, n2, i2, o2, s2) {
    try {
      var l2 = e2[o2](s2), a2 = l2.value;
    } catch (e3) {
      return void r2(e3);
    }
    l2.done ? t2(a2) : Promise.resolve(a2).then(n2, i2);
  }
  function Ee(e2) {
    return function() {
      var t2 = this, r2 = arguments;
      return new Promise(function(n2, i2) {
        var o2 = e2.apply(t2, r2);
        function s2(e3) {
          Me(o2, n2, i2, s2, l2, "next", e3);
        }
        function l2(e3) {
          Me(o2, n2, i2, s2, l2, "throw", e3);
        }
        s2(void 0);
      });
    };
  }
  var Fe = (e2 = {}) => {
    let { parentOrigin: t2 = "*", timeout: r2, debug: n2 = false, config: i2 = {} } = e2, o2 = /* @__PURE__ */ ((e3) => (...t3) => {
      e3 && console.log("[Penpal]", ...t3);
    })(n2), s2 = /* @__PURE__ */ ((e3, t3) => {
      let r3 = [], n3 = false;
      return { destroy(i3) {
        n3 || (n3 = true, t3(`${e3}: Destroying connection`), r3.forEach((e4) => {
          e4(i3);
        }));
      }, onDestroy(e4) {
        n3 ? e4() : r3.push(e4);
      } };
    })("App", o2), { destroy: l2, onDestroy: a2 } = s2;
    return { promise: new Promise((e3, n3) => {
      let u2 = j(r2, l2), p2 = (r3) => {
        if ((() => {
          try {
            clearTimeout(void 0);
          } catch (g2) {
            return false;
          }
          return true;
        })() && r3.source === parent && r3.data && r3.data.penpal === g.SynAck) {
          let n4 = r3.data, l3 = new J(n4.id, n4.appName), a3 = new J(n4.id + "/api", n4.appName), c2 = n4.id, d2 = {}, f2 = (e4) => "api/" + e4, h2 = { $emit: (e4, ...t3) => {
            l3.getEventCallBackLength(e4) > 0 ? l3.$pureEmit(e4, ...t3) : null == d2 || d2.$off(e4, () => {
            }, true);
          }, onQueryResult: (e4) => {
            a3.$pureEmit(f2(e4.reqid), e4);
          }, onOsNotify: (e4) => {
          } }, v2 = (e4) => function(t3) {
            let r4 = f2(e4);
            a3.$on(r4, function e5(n5) {
              t3.next(n5), n5.reqid && "succ" === n5.result && (t3.complete(), a3.$off(r4, e5));
            });
          }, y2 = $(h2), g2 = T(t2, y2, N(N({}, i2), {}, { postmateVersion: "0.1.3" }), s2, o2)(r3), b2 = {}, m2 = g2.bus;
          if (m2) {
            let e4 = (e5, t3, r4) => {
              r4 ? (t3.$__once = true, l3.$once(e5, t3)) : l3.$on(e5, t3), b2[e5] ? b2[e5].push(t3) : (b2[e5] = [t3], m2.$on(e5, c2));
            };
            Object.assign(d2, m2, { $on: e4, $off: (e5, t3, r4) => {
              var n5;
              if (b2[e5]) {
                let r5 = b2[e5].indexOf(t3);
                r5 > -1 && (b2[e5].splice(r5, 1), l3.$off(e5, t3));
              }
              r4 && delete b2[e5], null != (n5 = b2[e5]) && n5.length || (m2.$off(e5, c2), delete b2[e5]);
            }, $once: (t3, r4) => {
              e4(t3, r4, true);
            } });
          }
          let w2 = N(N({}, g2), {}, { bus: d2, query: (function() {
            var e4 = Ee(function* (e5, t3) {
              let r4 = (null == e5 ? void 0 : e5.reqid) || (yield g2.genReqId());
              return new Promise((n5, i3) => {
                g2.query(N(N({}, e5), {}, { reqid: r4 }), t3).then((e6) => {
                  "succ" === (null == e6 ? void 0 : e6.result) ? n5(e6) : i3(e6);
                });
              });
            });
            return function(t3, r4) {
              return e4.apply(this, arguments);
            };
          })(), createObservableQuery: (function() {
            var e4 = Ee(function* (e5, t3 = {}) {
              let r4 = (null == e5 ? void 0 : e5.reqid) || (yield g2.genReqId()), n5 = new Pe(v2(r4));
              return g2.query(N(N({}, e5), {}, { reqid: r4 }), N(N({}, t3), {}, { observable: true })), n5;
            });
            return function(t3) {
              return e4.apply(this, arguments);
            };
          })() });
          g2 && (window.removeEventListener(A.Message, p2), u2(), e3({ methods: w2, config: r3.data.config }));
        }
      };
      window.addEventListener(A.Message, p2), (() => {
        o2("Child: Handshake - Sending SYN");
        let e4 = { penpal: g.Syn }, r3 = t2 instanceof RegExp ? "*" : t2;
        window.parent.postMessage(e4, r3);
      })(), a2((e4) => {
        window.removeEventListener(A.Message, p2), e4 && n3(e4);
      });
    }), destroy() {
      l2();
    } };
  };
  var $e = "trimjs-extension-host";
  function _e() {
    return "undefined" != typeof crypto && "function" == typeof crypto.randomUUID ? crypto.randomUUID() : `web-ext-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function je(e2) {
    if (!e2 || "object" != typeof e2) return false;
    const t2 = e2;
    return t2.source === $e && 1 === t2.version && "string" == typeof t2.requestId && ("request" === t2.kind || "response" === t2.kind || "event" === t2.kind);
  }
  function ke(e2) {
    const t2 = /* @__PURE__ */ new Error(`NotSupportedInExtensionHost: ${e2}`);
    throw t2.code = "NotSupportedInExtensionHost", t2;
  }
  function We(e2) {
    var t2;
    const r2 = null !== (t2 = null == e2 ? void 0 : e2.timeoutMs) && void 0 !== t2 ? t2 : 1500, n2 = /* @__PURE__ */ new Map(), i2 = /* @__PURE__ */ new Set(), o2 = (e3) => {
      if (je(t3 = e3.data) && "response" === t3.kind) {
        const t4 = n2.get(e3.data.requestId);
        if (!t4) return;
        return n2.delete(e3.data.requestId), clearTimeout(t4.timeoutId), void t4.resolve(e3.data);
      }
      var t3;
      (function(e4) {
        return je(e4) && "event" === e4.kind;
      })(e3.data) && i2.forEach((t4) => {
        t4(e3.data);
      });
    };
    return window.addEventListener("message", o2), { request: (e3, t3, i3) => s(function* () {
      const o3 = (function(e4, t4) {
        return { source: $e, version: 1, kind: "request", requestId: _e(), payload: { method: e4, params: t4 } };
      })(e3, t3), s2 = yield new Promise((t4, s3) => {
        let l3;
        const a3 = i3 && "timeoutMs" in i3 ? i3.timeoutMs : r2;
        "number" == typeof a3 && a3 >= 0 && (l3 = setTimeout(() => {
          n2.delete(o3.requestId), s3(/* @__PURE__ */ new Error(`Extension host timeout while calling ${e3}`));
        }, a3)), n2.set(o3.requestId, { resolve: t4, reject: s3, timeoutId: l3 }), window.postMessage(o3, "*");
      });
      var l2, a2;
      if (!s2.payload.ok) throw new Error(null !== (l2 = null === (a2 = s2.payload.error) || void 0 === a2 ? void 0 : a2.message) && void 0 !== l2 ? l2 : `Extension host request failed: ${e3}`);
      return s2.payload.result;
    })(), onEvent: (e3) => (i2.add(e3), () => {
      i2.delete(e3);
    }), destroy() {
      window.removeEventListener("message", o2), n2.forEach((e3) => {
        clearTimeout(e3.timeoutId), e3.reject(/* @__PURE__ */ new Error("Extension bridge destroyed"));
      }), n2.clear(), i2.clear();
    } };
  }
  function qe() {
    return (qe = s(function* (e2) {
      const t2 = We();
      try {
        var r2;
        const i2 = yield t2.request("handshake", { debug: null !== (r2 = null == e2 ? void 0 : e2.debug) && void 0 !== r2 && r2 }, { timeoutMs: 5e3 });
        return n.log("Extension host probe response:", i2), true === i2.available;
      } catch (i2) {
        return n.log("Extension host probe failed:", i2), false;
      } finally {
        t2.destroy();
      }
    })).apply(this, arguments);
  }
  function xe() {
    return xe = s(function* () {
      const e2 = We(), t2 = /* @__PURE__ */ new Map();
      e2.onEvent((e3) => {
        const r3 = t2.get(e3.payload.event);
        null == r3 || r3.forEach((t3) => {
          t3(e3.payload.data);
        });
      }), yield e2.request("handshake", {}, { timeoutMs: 5e3 });
      const r2 = yield e2.request("getPlatformConfig", {}), n2 = { bus: { $on(r3, n3) {
        var i3;
        const o3 = null !== (i3 = t2.get(r3)) && void 0 !== i3 ? i3 : /* @__PURE__ */ new Set(), s2 = 0 === o3.size;
        o3.add(n3), t2.set(r3, o3), s2 && e2.request("subscribe", { event: r3 });
      }, $off(r3, n3) {
        const i3 = t2.get(r3);
        i3 && (i3.delete(n3), 0 === i3.size && (t2.delete(r3), e2.request("unsubscribe", { event: r3 })));
      }, $once(e3, t3) {
        const r3 = function() {
          n2.bus.$off(e3, r3), t3(...arguments);
        };
        n2.bus.$on(e3, r3);
      }, $emit() {
        ke("bus.$emit");
      } }, genReqId: () => _e(), query: (t3, r3) => e2.request("query", { params: t3, config: r3 }), createObservableQuery: (o2 = s(function* () {
        return ke("createObservableQuery");
      }), function() {
        return o2.apply(this, arguments);
      }), openApp: () => ke("openApp"), openAppSetting: () => ke("openAppSetting"), openCustomApp: () => ke("openCustomApp"), setTitle: () => ke("setTitle"), pickFile: (t3) => e2.request("pickFile", t3, { timeoutMs: null }), pickUserFile: () => ke("pickUserFile"), pickSharedFile: () => ke("pickSharedFile"), showFileDetails: (e3, t3) => ke("showFileDetails"), authorizeUserFile: (e3) => ke("authorizeUserFile"), authorizeSharedFile: (e3) => ke("authorizeSharedFile"), close: (i2 = s(function* () {
        e2.destroy();
      }), function() {
        return i2.apply(this, arguments);
      }), refreshToken: () => e2.request("refreshToken", {}), setExitPageTips: () => ke("setExitPageTips"), openFileManagerApp: () => ke("openFileManagerApp"), openFileManager: () => ke("openFileManager"), openFile: () => ke("openFile"), getPlatformConfig: () => Promise.resolve(r2), getHostSnapshot: () => e2.request("getHostSnapshot", {}) };
      var i2, o2, l2;
      return { methods: n2, config: (l2 = r2, { appName: "extension-host", os: { version: l2.systemVersion, theme: l2.theme, language: l2.language, format: { date: { date: l2.format.date, time: l2.format.time } } } }) };
    }), xe.apply(this, arguments);
  }
  var Ne = null;
  function Te() {
    return (Te = s(function* (e2) {
      const t2 = Fe({ debug: null == e2 ? void 0 : e2.debug, timeout: 1500 });
      try {
        const e3 = yield t2.promise;
        return e3;
      } catch (r2) {
        return t2.destroy(), n.log("Native OS connection probe failed:", r2), null;
      }
    })).apply(this, arguments);
  }
  var Ie = (e2) => Ne || (Ne = s(function* () {
    if ("undefined" != typeof window && window.parent !== window) {
      const t2 = yield (function(e3) {
        return Te.apply(this, arguments);
      })(e2);
      if (t2) return t2;
    }
    return (yield (function(e3) {
      return qe.apply(this, arguments);
    })(e2)) ? (function() {
      return xe.apply(this, arguments);
    })() : Fe({ debug: null == e2 ? void 0 : e2.debug }).promise;
  })());
  var Ce = { pickFile: "pick-file", pickUserFile: "pick-user-file", pickSharedFile: "pick-shared-file", authorizeUserFile: "authorize-user-file", authorizeSharedFile: "authorize-shared-file" };
  var Ve = class {
    constructor() {
      r(this, "options", void 0), r(this, "flutterInAppWebView", null), r(this, "osConnector", null), r(this, "initPromise", void 0), r(this, "appApiVersion", void 0), r(this, "isWeb", true), r(this, "isStandaloneWeb", false);
      let e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      this.options = e2, e2.debug && (n.setDebug(true), n.log("Trim App initialized with debug mode")), n.log("Options:", e2), this.initPromise = this.init();
    }
    init() {
      var e2 = this;
      return s(function* () {
        return n.log("Starting initialization..."), new Promise((t2) => {
          if (i()) e2.isWeb = false, n.log("Initializing mobile platform..."), new Promise((e3) => {
            var t3;
            (p ? window.flutter_inappwebview : u || (null === (t3 = window.flutter_inappwebview) || void 0 === t3 ? void 0 : t3._platformReady)) ? (n.log("flutter_inappwebview is ready"), e3(window.flutter_inappwebview)) : window.addEventListener("flutterInAppWebViewPlatformReady", () => {
              n.log("flutter_inappwebview is ready"), e3(window.flutter_inappwebview);
            });
          }).then((r2 = s(function* (r3) {
            yield e2.initMobileAppApi(r3), n.log("Mobile platform initialized"), t2();
          }), function(e3) {
            return r2.apply(this, arguments);
          }));
          else {
            if (e2.isWeb = true, e2.isStandaloneWeb = "undefined" != typeof window && window.parent === window, e2.isStandaloneWeb) return n.log("Standalone web platform detected; host bridge initialization skipped"), void t2();
            n.log("Initializing web platform..."), Ie().then((r3) => {
              e2.osConnector = r3, n.log("Web platform initialized"), t2();
            });
          }
          var r2;
        });
      })();
    }
    getWebMethods() {
      var e2;
      const t2 = null === (e2 = this.osConnector) || void 0 === e2 ? void 0 : e2.methods;
      if (!t2) throw new Error("Host bridge is not available outside iframe or app runtime");
      return t2;
    }
    loadAppMessage() {
      var e2 = this;
      return s(function* () {
        return e2.callAppMethod("getAppMessage");
      })();
    }
    initMobileAppApi(e2) {
      var t2 = this;
      return s(function* () {
        t2.flutterInAppWebView = e2;
        try {
          const e3 = yield t2.loadAppMessage();
          t2.appApiVersion = null == e3 ? void 0 : e3.appApi;
        } catch (r2) {
          n.log("Failed to load mobile appApi version:", r2), t2.appApiVersion = void 0;
        }
      })();
    }
    assertMobileAppApi(e2) {
      let t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "v1.0";
      if (!this.isAtLeastVersion(this.appApiVersion, t2)) throw new Error(`${e2} requires appApi >= ${t2}`);
    }
    isAtLeastVersion(e2, t2) {
      if (!e2) return false;
      const r2 = this.parseVersion(e2), n2 = this.parseVersion(t2), i2 = Math.max(r2.length, n2.length);
      for (let l2 = 0; l2 < i2; l2 += 1) {
        var o2, s2;
        const e3 = null !== (o2 = r2[l2]) && void 0 !== o2 ? o2 : 0, t3 = null !== (s2 = n2[l2]) && void 0 !== s2 ? s2 : 0;
        if (e3 > t3) return true;
        if (e3 < t3) return false;
      }
      return true;
    }
    parseVersion(e2) {
      return e2.replace(/^v/i, "").split(".").map((e3) => Number.parseInt(e3, 10) || 0);
    }
    callAppMethod(e2) {
      var t2 = arguments, r2 = this;
      return s(function* () {
        if (!r2.flutterInAppWebView) return null;
        for (var n2 = t2.length, i2 = new Array(n2 > 1 ? n2 - 1 : 0), o2 = 1; o2 < n2; o2++) i2[o2 - 1] = t2[o2];
        return c(r2.flutterInAppWebView, e2, ...i2);
      })();
    }
    ready() {
      var e2 = this;
      return s(function* () {
        return e2.initPromise;
      })();
    }
    getOptions() {
      return this.options;
    }
    setOptions(e2) {
      this.options = a(a({}, this.options), e2), void 0 !== e2.debug && n.setDebug(e2.debug), n.log("Options updated:", this.options);
    }
    getPlatformConfig() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, e2.isWeb) {
          const t3 = yield e2.getWebMethods().getPlatformConfig();
          if (!t3) throw new Error("Failed to get platform config");
          return t3;
        }
        if (e2.appApiVersion) {
          const t3 = yield e2.callAppMethod("getPlatformConfig");
          if (!t3) throw new Error("Failed to get platform config");
          return t3;
        }
        const t2 = yield e2.loadAppMessage();
        if (!t2) throw new Error("Failed to get platform config");
        return e2.appApiVersion = t2.appApi, { theme: t2.nightMode, language: t2.language, appVersion: t2.appVersion, systemVersion: t2.systemVersion, format: { date: t2.dateFormat, time: t2.timeFormat } };
      })();
    }
    getHostSnapshot() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, !e2.isWeb) throw new Error("getHostSnapshot is not supported on mobile platform");
        const t2 = yield e2.getWebMethods().getHostSnapshot();
        if (!t2) throw new Error("Failed to get host snapshot");
        return t2;
      })();
    }
    getAppAuthBaseUrl() {
      var e2 = this;
      return s(function* () {
        if ("undefined" != typeof window && window.parent !== window) {
          const e3 = document.referrer;
          if (e3) try {
            return new URL(e3).origin;
          } catch (t2) {
            n.log("Failed to derive app auth base url from document.referrer:", t2);
          }
        }
        if ("undefined" != typeof window) return window.location.origin;
        if (yield e2.initPromise, e2.isWeb) try {
          const t2 = yield e2.getHostSnapshot();
          if (t2.host) return t2.host;
        } catch (t2) {
          n.log("Failed to derive app auth host snapshot:", t2);
        }
        throw new Error("Failed to derive app auth base url");
      })();
    }
    buildAppAuthUrl(e2, t2) {
      var r2 = this;
      return s(function* () {
        return (function(e3, t3, r3, n2) {
          var i2, o2;
          const s2 = new URL(e3, null !== (i2 = null != n2 ? n2 : null === (o2 = globalThis.location) || void 0 === o2 ? void 0 : o2.origin) && void 0 !== i2 ? i2 : "http://localhost"), l2 = Ce[t3];
          if (s2.pathname = (function(e4) {
            return `/app-auth/${e4}`;
          })(l2), s2.searchParams.set("appName", r3.appName), r3.redirectUri && s2.searchParams.set("redirectUri", r3.redirectUri), r3.state && s2.searchParams.set("state", r3.state), "pickFile" === t3 || "pickUserFile" === t3 || "pickSharedFile" === t3) {
            var a2;
            const e4 = r3;
            "pickSharedFile" !== t3 && e4.directory && s2.searchParams.set("directory", "true");
            const n3 = "pickSharedFile" !== t3 ? e4.accept : void 0;
            (null == n3 ? void 0 : n3.length) && s2.searchParams.set("accept", n3.join(",")), (null === (a2 = e4.sidebarGroup) || void 0 === a2 ? void 0 : a2.length) && s2.searchParams.set("sidebarGroup", e4.sidebarGroup.join(","));
          } else s2.searchParams.set("path", r3.path);
          return s2.toString();
        })(yield r2.getAppAuthBaseUrl(), e2, t2, window.location.origin);
      })();
    }
    openAppAuth(e2, t2, r2) {
      var n2 = this;
      return s(function* () {
        const i2 = yield n2.buildAppAuthUrl(e2, t2);
        return "_self" === (null == r2 ? void 0 : r2.target) && "undefined" != typeof window ? (window.location.assign(i2), i2) : (yield n2.openURL(i2, null == r2 ? void 0 : r2.target, null == r2 ? void 0 : r2.features), i2);
      })();
    }
    parseAppAuthCallback(e2) {
      return (function(e3) {
        var t2, r2, n2, i2;
        const o2 = e3 instanceof URLSearchParams ? e3 : e3 instanceof URL ? e3.searchParams : "string" == typeof e3 ? new URL(e3, null !== (t2 = null === (r2 = globalThis.location) || void 0 === r2 ? void 0 : r2.origin) && void 0 !== t2 ? t2 : "http://localhost").searchParams : new URLSearchParams(null !== (n2 = null === (i2 = globalThis.location) || void 0 === i2 ? void 0 : i2.search) && void 0 !== n2 ? n2 : ""), s2 = o2.get("method"), l2 = s2 && Object.prototype.hasOwnProperty.call(Ce, s2) ? s2 : void 0, a2 = o2.get("path");
        let u2;
        if (a2) try {
          const e4 = JSON.parse(a2);
          Array.isArray(e4) && e4.every((e5) => "string" == typeof e5) && (u2 = e4);
        } catch (p2) {
          u2 = void 0;
        }
        return { status: o2.get("status") || void 0, error: o2.get("error") || void 0, method: l2, appName: o2.get("appName") || void 0, state: o2.get("state") || void 0, path: u2 };
      })(e2);
    }
    setTitle(e2) {
      var t2 = this;
      return s(function* () {
        if (yield t2.initPromise, n.log("Setting title:", e2), document.title = e2, t2.isWeb) return t2.getWebMethods().setTitle(e2);
      })();
    }
    setExitPageTips(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().setExitPageTips(e2) : t2.callAppMethod("setExitPageTips", e2 ? JSON.stringify(e2) : "");
      })();
    }
    openFile(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, n.log("Opening file:", e2), t2.isWeb ? t2.getWebMethods().openFile(e2) : t2.callAppMethod("openFile", e2);
      })();
    }
    openFileManager(e2) {
      var t2 = this;
      return s(function* () {
        if (yield t2.initPromise, n.log("Opening file manager:", e2), t2.isWeb) {
          const r2 = t2.getWebMethods();
          return (r2.openFileManager || r2.openFileManagerApp)(e2);
        }
        return t2.assertMobileAppApi("openFileManager"), t2.callAppMethod("openFileManager", e2);
      })();
    }
    showFileDetails(e2, t2) {
      var r2 = this;
      return s(function* () {
        return yield r2.initPromise, r2.isWeb ? r2.getWebMethods().showFileDetails(e2, t2) : (r2.assertMobileAppApi("showFileDetails"), r2.callAppMethod("showFileDetails", JSON.stringify({ paths: e2, options: t2 })));
      })();
    }
    authorizeUserFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2;
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().authorizeUserFile(e2) : (t2.assertMobileAppApi("authorizeUserFile"), null !== (r2 = yield t2.callAppMethod("authorizeUserFile", JSON.stringify({ path: e2 }))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    authorizeSharedFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2;
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().authorizeSharedFile(e2) : (t2.assertMobileAppApi("authorizeSharedFile"), null !== (r2 = yield t2.callAppMethod("authorizeSharedFile", JSON.stringify({ path: e2 }))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    openAppSetting() {
      var e2 = this;
      return s(function* () {
        return yield e2.initPromise, n.log("Opening app setting"), e2.isWeb ? e2.getWebMethods().openAppSetting() : (e2.assertMobileAppApi("openAppSetting"), e2.callAppMethod("openAppSetting"));
      })();
    }
    openApp(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, n.log("Opening app:", e2), t2.isWeb ? t2.getWebMethods().openApp(e2) : !!i() && t2.callAppMethod("openAppPage", e2);
      })();
    }
    openCustomApp(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, n.log("Opening custom app:", e2, t2), r2.isWeb) return r2.getWebMethods().openCustomApp(e2, t2);
        throw new Error("openCustomApp is not supported on mobile platform");
      })();
    }
    openURL(e2, t2, r2) {
      var i2 = this;
      return s(function* () {
        if (yield i2.initPromise, n.log("Opening URL:", e2, t2, r2), !i2.isWeb) return i2.callAppMethod("openSystemBrowser", e2);
        if ("_self" === t2) return void window.location.assign(e2);
        if (!r2) return void window.open(e2, t2, r2);
        const o2 = window.open("", t2, r2);
        o2 && (o2.location.href = e2);
      })();
    }
    close() {
      var e2 = this;
      return s(function* () {
        return yield e2.initPromise, e2.isWeb ? e2.getWebMethods().close() : e2.callAppMethod("exitPage");
      })();
    }
    query(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, r2.isWeb) {
          if (null == t2 ? void 0 : t2.observable) return r2.getWebMethods().createObservableQuery(e2, t2);
          const n3 = yield r2.getWebMethods().query(e2, t2);
          if (!n3) throw new Error("Failed to query");
          return n3;
        }
        if (r2.assertMobileAppApi("query"), null == t2 ? void 0 : t2.observable) {
          if (!r2.flutterInAppWebView) throw new Error("Failed to start observable query");
          return (function(e3, t3, r3) {
            return v(), new f((n3) => {
              let i2, o2 = false;
              return c(e3, "wsQuery", null == t3 ? void 0 : t3.req, JSON.stringify(t3), void 0 === r3 ? void 0 : JSON.stringify(r3)).then((e4) => {
                (null == e4 ? void 0 : e4.reqId) ? (i2 = e4.reqId, o2 || h.set(i2, n3)) : n3.error(/* @__PURE__ */ new Error("Failed to start observable query"));
              }, (e4) => {
                n3.error(e4);
              }), () => {
                o2 = true, i2 && h.delete(i2);
              };
            });
          })(r2.flutterInAppWebView, e2, t2);
        }
        const n2 = yield r2.callAppMethod("wsQuery", null == e2 ? void 0 : e2.req, JSON.stringify(e2), void 0 === t2 ? void 0 : JSON.stringify(t2));
        if (!n2) throw new Error("Failed to query");
        if ("succ" !== n2.result) throw n2;
        return n2;
      })();
    }
    refreshToken() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, !e2.isWeb) throw new Error("refreshToken is not supported on mobile platform");
        return e2.getWebMethods().refreshToken();
      })();
    }
    $on(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$on is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$on(e2, t2);
      })();
    }
    $off(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$off is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$off(e2, t2);
      })();
    }
    $once(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$once is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$once(e2, t2);
      })();
    }
    pickFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2, n2;
        return yield t2.initPromise, t2.isWeb ? null === (r2 = t2.osConnector) || void 0 === r2 ? void 0 : r2.methods.pickFile(e2) : t2.isAtLeastVersion(t2.appApiVersion, "v1.0") ? null !== (n2 = yield t2.callAppMethod("pickFile", JSON.stringify(e2))) && void 0 !== n2 ? n2 : void 0 : t2.flutterInAppWebView ? (function(e3, t3) {
          return y.apply(this, arguments);
        })(t2.flutterInAppWebView, e2) : void 0;
      })();
    }
    pickUserFile() {
      var e2 = arguments, t2 = this;
      return s(function* () {
        var r2;
        let n2 = e2.length > 0 && void 0 !== e2[0] ? e2[0] : {};
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().pickUserFile(n2) : (t2.assertMobileAppApi("pickUserFile"), null !== (r2 = yield t2.callAppMethod("pickUserFile", JSON.stringify(n2))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    pickSharedFile() {
      var e2 = arguments, t2 = this;
      return s(function* () {
        var r2;
        let n2 = e2.length > 0 && void 0 !== e2[0] ? e2[0] : {};
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().pickSharedFile(n2) : (t2.assertMobileAppApi("pickSharedFile"), null !== (r2 = yield t2.callAppMethod("pickSharedFile", JSON.stringify(n2))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
  };

  // build_entry.js
  if (typeof window !== "undefined") {
    window.TrimApp = Ve;
  }
})();
