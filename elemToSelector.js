// create css selector from element

// adapted from https://stackoverflow.com/questions/42184322/javascript-get-element-unique-selector/67840046#67840046
function elemToSelector(elem, options={}) {
  const defaults = {compact:false, fullPath:false};
  options = {...defaults, ...options};
  const {compact, fullPath} = options;
  // console.log(options, compact, fullPath);
  const tagName = elem.tagName.toLowerCase();
  const id = elem.getAttribute('id') ?? '';
  const parentNode = elem.parentNode;
  const hasId = id !== '';
  const parentElement = elem?.parentElement;
  
  // computed later
  let elementsWithSameId = [];
  let uniqueIds = true;
 
  if (tagName === 'html') return 'html';

  let str = (hasId && !fullPath) ? '' : tagName;
  if (hasId && !fullPath) {
    if (id.match(/^[a-zA-Z]/)) {
      str += '#' + jq(id);
    } else {
      str += `[id="${id}"]`;
    }
    elementsWithSameId = document.querySelectorAll(str);
    uniqueIds = elementsWithSameId.length === 1;
    if (compact) {
      if (uniqueIds) {
        return str; // return early, at the first element with id (assumes all ids are unique)
      } else {
        console.warn('Same ids', elementsWithSameId);
      }
    }
  }

  if (elem.classList?.length > 0 && !fullPath)  {
    let classes = Array.from(elem.classList.values()).map((cls) => { return jq(cls) });
    str += "." + classes.join('.');
  }
  
  // console.log(str, elem);
  
  if ((fullPath && parentElement?.childElementCount > 1) || (!hasId && parentElement?.childElementCount > 1 || (hasId && !uniqueIds))) {
    let similarSiblings = Array.from(parentElement.children).filter((e) => { return e.matches(str); });
    console.log(options, str, similarSiblings.length);
    if ((compact && (similarSiblings.length > 1 || !uniqueIds)) || (fullPath && (similarSiblings.length > 1))) {
      let childIndex = 1;
      for (let e = elem; e.previousElementSibling; e = e.previousElementSibling) {
        childIndex += 1;
      }
      str += `:nth-child(${childIndex})`;
    }
  }
  
  return `${elemToSelector(parentNode, options)} > ${str}`;
}

// https://stackoverflow.com/questions/70579/html-valid-id-attribute-values
// adapted from https://learn.jquery.com/using-jquery-core/faq/how-do-i-select-an-element-by-an-id-that-has-characters-used-in-css-notation/
function jq(myid) {
  return myid.replace(/(:|\.|\[|\]|,|=|@| )/g, "\\$1");
}

function xpathQuery(expr, context, resultType) {
  context = context ?? document;
  resultType = resultType ?? XPathResult.ANY_TYPE;
  
  let result = document.evaluate(expr, context, null, resultType, null);
  let results = [];
  let curr = result.iterateNext();
  while (curr) {
    results.push(curr);
    curr = result.iterateNext();
  }
  
  return results;
}

// test all elements on page
function testElemToSelector() {
  const options = {compact:true};
  let elements = document.querySelectorAll('*');
  console.log('options:', options);
  console.log(elements.length + ' elements');
  let allGood = true;
  for (el of elements) {
    let selector = elemToSelector(el, options);
    let first = document.querySelector(selector);
    let findings = document.querySelectorAll(selector);
    let ok = (first === el || findings.length === 1);
    if (!ok) {
      allGood = false;
      console.warn('Mmmhh...', {
        element: el, 
        selector: selector,
        first: first,
        findings: findings
      });
    }
  }
  console.log('allGood:', allGood);

  // select an element in Elements tab of your navigator Devtools, or replace $0
  document.querySelector(elemToSelector($0)) === $0 &&
  document.querySelectorAll(elemToSelector($0)).length === 1;
}
