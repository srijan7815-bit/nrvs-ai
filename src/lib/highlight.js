// Lightweight syntax highlighter — no external deps.
// Returns HTML string with <span class="hl-..."> wrappers.
// SECURITY: All branches escape the raw input FIRST, then wrap tokens in spans.
// No branch ever passes raw user/LLM content through without escaping.

const LANG_KEYWORDS = {
  javascript: ['async','await','function','const','let','var','return','if','else','for','while','do','switch','case','break','continue','try','catch','finally','throw','new','class','extends','import','export','default','from','of','in','typeof','instanceof','null','undefined','true','false','this','super','static','get','set','yield','delete','void','enum','interface','type','implements','private','public','protected','readonly','abstract','as','keyof','infer','never','unknown'],
  typescript: ['async','await','function','const','let','var','return','if','else','for','while','switch','case','break','continue','try','catch','finally','throw','new','class','extends','import','export','default','from','of','in','typeof','instanceof','null','undefined','true','false','this','super','static','get','set','yield','delete','void','enum','interface','type','implements','private','public','protected','readonly','abstract','as','keyof','infer','never','unknown','namespace','module','declare','readonly','keyof','extends'],
  python: ['def','class','return','if','elif','else','for','while','break','continue','try','except','finally','raise','with','as','import','from','True','False','None','and','or','not','in','is','lambda','yield','global','nonlocal','assert','pass','del','async','await'],
  html: ['html','head','body','div','span','script','style','meta','link','title','p','h1','h2','h3','h4','h5','h6','a','img','ul','ol','li','table','tr','td','th','thead','tbody','form','input','button','textarea','select','option','label','br','hr','pre','code','nav','header','footer','section','article','aside','main','figure','figcaption'],
  css: ['color','background','background-color','margin','padding','border','width','height','display','flex','grid','position','top','right','bottom','left','z-index','font-size','font-weight','font-family','text-align','line-height','opacity','transform','transition','animation','overflow','cursor','box-shadow','border-radius','justify-content','align-items','flex-direction','gap','max-width','min-width','min-height','max-height','visibility','content'],
  rust: ['fn','let','mut','const','if','else','match','for','while','loop','break','continue','return','struct','enum','impl','trait','type','use','mod','pub','crate','self','Self','super','where','async','await','move','ref','static','unsafe','extern','dyn','true','false'],
  go: ['func','var','const','if','else','for','range','switch','case','default','break','continue','return','struct','interface','type','map','chan','select','go','defer','make','new','nil','true','false','package','import','fallthrough'],
  java: ['public','private','protected','class','interface','extends','implements','static','final','abstract','void','int','long','double','float','boolean','char','byte','short','String','new','return','if','else','for','while','do','switch','case','break','continue','try','catch','finally','throw','throws','import','package','this','super','null','true','false','instanceof','finalize','enum','assert'],
  cpp: ['int','long','double','float','char','bool','void','auto','const','static','class','struct','enum','union','namespace','using','public','private','protected','virtual','override','new','delete','return','if','else','for','while','do','switch','case','break','continue','try','catch','throw','template','typename','nullptr','true','false','include','define'],
  bash: ['if','then','else','fi','for','while','do','done','case','esac','function','return','exit','echo','export','local','readonly','unset','shift','source','alias','unalias','cd','pwd','ls','grep','sed','awk','cat','head','tail','wc','sort','uniq','find','xargs','chmod','chown','mkdir','rm','cp','mv','curl','wget','npm','node','pip','python'],
  json: [],
}

const HL_COLORS = {
  keyword: 'text-blue-400',
  string:  'text-green-400',
  comment: 'text-gray-500',
  number:  'text-orange-400',
  func:    'text-yellow-300',
  tag:     'text-pink-400',
  attr:    'text-cyan-400',
  prop:    'text-cyan-300',
  boolean: 'text-orange-300',
  self:    'text-blue-300',
}

/** HTML-escape a string — used on ALL input before any markup is added. */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function span(cls, text) {
  return `<span class="${cls}">${text}</span>`
}

/**
 * Highlight `code` string with optional `lang`.
 * Returns an HTML string with span wrappers.
 * SECURITY: Every branch starts by escaping the raw code, so no untrusted
 * content is ever injected raw into the DOM via dangerouslySetInnerHTML.
 */
export function highlight(code, lang) {
  lang = (lang || '').toLowerCase()
  const kw = LANG_KEYWORDS[lang] || []

  // ── SECURITY: Escape raw input FIRST for ALL branches ──
  const safe = esc(code)

  // For HTML, color tags and attributes on the ESCAPED content
  if (lang === 'html') {
    return safe
      .replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*)/g, (_, tag) => span(HL_COLORS.tag, tag))
      .replace(/([a-zA-Z-]+)(=)/g, (_, attr, eq) => span(HL_COLORS.attr, attr) + eq)
      .replace(/(&gt;)/g, (_, g) => span(HL_COLORS.tag, g))
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, (m) => span(HL_COLORS.comment, m))
  }

  // For CSS, color property names and values on the ESCAPED content
  if (lang === 'css') {
    return safe
      .replace(/([a-z-]+)(\s*:)/gi, (_, prop, colon) => span(HL_COLORS.prop, prop) + colon)
      .replace(/(#[0-9a-fA-F]{3,8})/g, (m) => span(HL_COLORS.string, m))
      .replace(/(\d+\.?\d*)(px|em|rem|%|vh|vw|deg|s|ms)?/g, (m) => span(HL_COLORS.number, m))
      .replace(/(\/\*[\s\S]*?\*\/)/g, (m) => span(HL_COLORS.comment, m))
  }

  // For JSON — color keys and values on the ESCAPED content
  if (lang === 'json') {
    return safe
      .replace(/(&quot;)([^&]+)(&quot;\s*:)/g, (_, q, key, rest) => span(HL_COLORS.prop, key) + ':')
      .replace(/(:\s*)(&quot;(?:[^&]|\\.)*?&quot;)/g, (_, sp, val) => ':' + span(HL_COLORS.string, val))
      .replace(/(:\s*)(true|false|null)/g, (_, sp, v) => ':' + span(HL_COLORS.boolean, v))
      .replace(/(:\s*)(-?\d+\.?\d*)/g, (_, sp, v) => ':' + span(HL_COLORS.number, v))
  }

  // Generic: already escaped as `safe`
  let out = safe

  // Strings (double and single quoted, template literals)
  out = out
    .replace(/(&quot;[^&]*?&quot;|&quot;(?:[^&]|\\.)*?&quot;)/g, (m) => span(HL_COLORS.string, m))
    .replace(/(&#39;(?:[^&]|\\.)*?&#39;)/g, (m) => span(HL_COLORS.string, m))
    .replace(/(`(?:[^`\\]|\\.)*`)/g, (m) => span(HL_COLORS.string, m))

  // Comments
  out = out
    .replace(/(\/\/[^\n]*)/g, (m) => span(HL_COLORS.comment, m))
    .replace(/(\/\*[\s\S]*?\*\/)/g, (m) => span(HL_COLORS.comment, m))

  // Numbers
  out = out.replace(/\b(\d+\.?\d*)\b/g, (m) => span(HL_COLORS.number, m))

  // Keywords (word boundary)
  const kwRe = kw.length ? new RegExp('\\b(' + kw.join('|') + ')\\b', 'g') : null
  if (kwRe) out = out.replace(kwRe, (m) => span(HL_COLORS.keyword, m))

  // Function-like identifiers
  out = out.replace(/\b([a-z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, (m, name) => span(HL_COLORS.func, name + '('))

  return out
}
