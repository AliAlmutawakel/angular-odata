export const Types = {
  isObject(value: any): boolean {
    var type = typeof value;
    return value != null && (type === 'object' || type === 'function');
  },

  isFunction(value: any): boolean {
    return typeof value === "function";
  },

  isArray(value: any): boolean {
    return Array.isArray(value);
  },

  isEmpty(value: any): boolean {
    return value === undefined
      || value === null
      || (typeof (value) === 'string' && !value.length)
      || (Types.isArray(value) && !value.length)
      || (Types.isFunction(value.isEmpty) && value.isEmpty())
      || (Types.isArray(value) && (value as any[]).every(v => Types.isEmpty(v)))
      || (Types.isObject(value) && !Object.keys(value).filter(k => value.hasOwnProperty(k)).length);
  },

  isEqual(value1: any, value2: any) {
    function getType(obj: any) {
      return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    }

    function areDatesEqual () {
      return value1.getTime() === value2.getTime();
    }

    function areArraysBufferEqual () {

      if (value1.byteLength !== value2.byteLength) {
        return false;
      }

      var view1 = new DataView(value1);
      var view2 = new DataView(value2);

      var i = value1.byteLength;
      while (i--) {
        if (view1.getUint8(i) !== view2.getUint8(i)) {
          return false;
        }
      }

      return true;
    }

    function areArraysEqual () {

      // Check length
      if (value1.length !== value2.length) return false;

      // Check each item in the array
      for (let i = 0; i < value1.length; i++) {
        if (!Types.isEqual(value1[i], value2[i])) return false;
      }

      // If no errors, return true
      return true;

    }

    function areObjectsEqual () {

      if (Object.keys(value1).length !== Object.keys(value2).length) return false;

      // Check each item in the object
      for (let key in value1) {
        if (Object.prototype.hasOwnProperty.call(value1, key)) {
          if (!Types.isEqual(value1[key], value2[key])) return false;
        }
      }

      // If no errors, return true
      return true;

    }

    function areFunctionsEqual () {
      return value1.toString() === value2.toString();
    }

    function arePrimativesEqual () {
      return value1 === value2;
    }

    // Get the object type
    let type = getType(value1);

    // If the two items are not the same type, return false
    if (type !== getType(value2)) return false;

    // Compare based on type
    if (type === 'date') return areDatesEqual();
    if (type === 'arraybuffer') return areArraysBufferEqual();
    if (type === 'array') return areArraysEqual();
    if (type === 'object') return areObjectsEqual();
    if (type === 'function') return areFunctionsEqual();
    return arePrimativesEqual();
  }
}
