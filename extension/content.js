/* LibTV 一键绑定 @ — no credentials, network requests, or generation actions. */
(() => {
  'use strict';

  function scan(text) {
    const matches = [];
    const pattern = /@(?:image|图片|图)[ \t\u00a0\u3000]*(\d*)([A-Za-z_]*)(\.\d+)?/gi;
    for (const match of text.matchAll(pattern)) {
      const number = Number(match[1]);
      if (!/^[1-9]\d*$/.test(match[1]) || match[2] || match[3] || !Number.isSafeInteger(number)) {
        throw new Error(`编号格式无效：${match[0]}。请使用 @image1、@图片 1、@图1 等完整标记。`);
      }
      matches.push({ start: match.index, end: match.index + match[0].length, number, token: match[0] });
    }
    return matches;
  }

  function validate(matches, numbers) {
    const available = new Set(numbers);
    const missing = [...new Set(matches.filter(m => !available.has(m.number)).map(m => m.number))];
    if (missing.length) throw new Error(`缺少参考图片编号 ${missing.join('、')}；整段未转换。`);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { scan, validate };
    return;
  }
  if (typeof document === 'undefined') return;

  const EDITOR = '[contenteditable="true"][role="textbox"][aria-placeholder*="@引用素材"]';
  const states = new WeakMap();
  const activeStates = new Set();
  let scheduled = false;

  function visible(element) {
    return element.isConnected && element.getClientRects().length > 0;
  }

  function scopeOf(editor) {
    const node = editor.closest('.react-flow__node');
    if (node) return node;
    for (let scope = editor.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
      if (scope.querySelectorAll(EDITOR).length === 1 && scope.querySelector('button[aria-label="@"]')) return scope;
    }
    return null;
  }

  function references(scope) {
    const result = new Map();
    for (const button of scope.querySelectorAll('button[aria-label="@"]')) {
      const card = button.parentElement;
      const badges = Array.from(card.children).filter(e => e.tagName === 'SPAN' && /^[1-9]\d*$/.test(e.textContent.trim()));
      if (badges.length !== 1) throw new Error('无法可靠读取参考图编号；请保持参考缩略图列表展开。');
      const number = Number(badges[0].textContent.trim());
      if (result.has(number)) throw new Error(`参考编号 ${number} 重复，已停止。`);
      const image = card.querySelector('img');
      if (!image || !image.getAttribute('src')) throw new Error(`参考 ${number} 的图片缩略图不可用。`);
      result.set(number, { number, button, src: image.getAttribute('src').split('?')[0] });
    }
    return result;
  }

  function fingerprint(refs) {
    return JSON.stringify(Array.from(refs.values(), r => [r.number, r.src]));
  }

  function badgeToken(element) {
    return `{{ref:${element.getAttribute('data-mention-type')}:${element.getAttribute('data-mention-index')}:${element.getAttribute('data-mention-node-id')}:${element.getAttribute('data-mention-media-type') || ''}}}`;
  }

  function read(editor) {
    let text = '';
    const segments = [];
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue || '';
        segments.push({ node, start: text.length, end: text.length + value.length });
        text += value;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.hasAttribute('data-mention-type')) { text += badgeToken(node); return; }
      if (node.getAttribute('contenteditable') === 'false') { text += '\uFFFC'; return; }
      if (node.tagName === 'BR') { text += '\n'; return; }
      for (const child of node.childNodes) visit(child);
      if (node !== editor && /^(DIV|P|LI)$/.test(node.tagName)) text += '\n';
    }
    visit(editor);
    return { text, segments };
  }

  function rangeFor(snapshot, match) {
    const start = snapshot.segments.find(s => match.start >= s.start && match.start < s.end);
    const end = snapshot.segments.find(s => match.end > s.start && match.end <= s.end);
    if (!start || !end) throw new Error('占位符跨越了不可编辑标签，已停止。');
    const range = document.createRange();
    range.setStart(start.node, match.start - start.start);
    range.setEnd(end.node, match.end - end.start);
    return range;
  }

  function backupOf(editor) {
    const fragment = document.createDocumentFragment();
    for (const node of editor.childNodes) fragment.append(node.cloneNode(true));
    return fragment;
  }

  function restore(editor, backup) {
    editor.replaceChildren(backup.cloneNode(true));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }

  function turn() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function report(state, text, error = false) {
    state.status.textContent = text;
    state.status.dataset.error = String(error);
  }

  async function strictMode(state) {
    const toggle = state.scope.querySelector('input[aria-label="智能引用 AutoLink"]');
    if (toggle?.checked) {
      toggle.click();
      await turn();
      if (state.scope.querySelector('input[aria-label="智能引用 AutoLink"]')?.checked) {
        throw new Error('AutoLink 未能关闭；请在高级设置中关闭“智能引用 AutoLink”。');
      }
    }
    // If the setting isn't rendered, don't claim that it's off. Check at binding time.
    return Boolean(toggle);
  }

  async function bind(state) {
    if (state.busy) return;
    if (state.composing) { report(state, '请先完成当前中文输入。', true); return; }
    state.busy = true;
    state.bind.disabled = true;
    state.undo.disabled = true;
    let backup = null;
    let changed = false;
    const editor = state.editor;
    try {
      if (!visible(editor) || !state.scope.isConnected) throw new Error('当前编辑器已关闭，请重新打开节点。');
      if (/生成中\s*\d+%/.test(state.scope.textContent)) throw new Error('当前节点正在生成；请等待完成后再编辑引用。');
      const original = read(editor);
      const initialMatches = scan(original.text);
      if (!initialMatches.length) { report(state, '没有待转换的编号引用；已有引用保持不变。'); return; }
      const refs = references(state.scope);
      validate(initialMatches, refs.keys());
      const refFingerprint = fingerprint(refs);
      if (!await strictMode(state)) throw new Error('请先展开高级设置，确认“智能引用 AutoLink”开关可读取，再点击绑定。');
      if (read(editor).text !== original.text) throw new Error('提示词在检查期间发生变化，未执行绑定，请重试。');
      backup = backupOf(editor);
      state.lastUndo = null;
      const templates = new Map();
      // Obtain one VERIFIED native badge per distinct number. The native editor
      // may rebuild other badges and add display spaces; no output text is taken
      // from this temporary native-insertion pass.
      for (const number of new Set(initialMatches.map(m => m.number))) {
        if (!editor.isConnected) throw new Error('编辑器发生切换，已停止。');
        const currentRefs = references(state.scope);
        if (fingerprint(currentRefs) !== refFingerprint) throw new Error('参考图顺序在转换过程中改变，已停止。');
        const before = read(editor);
        const matches = scan(before.text);
        const match = matches.filter(m => m.number === number).at(-1);
        if (!match) throw new Error(`参考 ${number} 的原占位符在检查中丢失，已回退。`);
        const ref = currentRefs.get(match.number);
        const range = rangeFor(before, match);
        editor.focus({ preventScroll: true });
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        const oldBadges = new Set(editor.querySelectorAll('[data-mention-type]'));
        changed = true;
        // The only website buttons this extension clicks are native reference @ buttons
        // and the AutoLink switch. It never clicks submit/generate or sends Enter.
        ref.button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        ref.button.click();
        await turn();
        const added = Array.from(editor.querySelectorAll('[data-mention-type]')).filter(e => !oldBadges.has(e));
        // React may recreate all badges, so find the result by exact canonical text too.
        const candidates = added.filter(e => Number(e.getAttribute('data-mention-index')) === match.number);
        const badge = candidates.find(e => (e.getAttribute('data-mention-media-type') === 'image' || e.getAttribute('data-mention-type') === 'image') && e.getAttribute('data-mention-node-id'));
        if (!badge) throw new Error(`参考 ${match.number} 没有产生有效的图片引用，已回退。`);
        const badgeImage = badge.querySelector('img');
        if (!badgeImage || badgeImage.getAttribute('src').split('?')[0] !== ref.src) throw new Error(`参考 ${match.number} 的图片身份不一致，已回退。`);
        templates.set(number, badge.cloneNode(true));
      }

      if (fingerprint(references(state.scope)) !== refFingerprint) throw new Error('参考图顺序发生变化，已回退。');
      // Build exclusively from the original DOM, so every non-reference character,
      // line break, existing badge and reference ordering is retained.
      const output = document.createElement('div');
      output.append(backup.cloneNode(true));
      let expected = original.text;
      for (const match of [...initialMatches].reverse()) {
        const template = templates.get(match.number);
        expected = expected.slice(0, match.start) + badgeToken(template) + expected.slice(match.end);
      }
      let count = 0;
      while (true) {
        const snapshot = read(output);
        const matches = scan(snapshot.text);
        if (!matches.length) break;
        const match = matches.at(-1);
        const range = rangeFor(snapshot, match);
        range.deleteContents();
        range.insertNode(templates.get(match.number).cloneNode(true));
        count++;
      }
      if (count !== initialMatches.length || read(output).text !== expected) throw new Error('完整提示词校验失败，已回退。');
      editor.replaceChildren(...Array.from(output.childNodes));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
      await turn();
      const nativeDisplay = text => text.replace(/[ \t]*(\{\{ref:[^}]+\}\})[ \t]*/g, '$1');
      if (nativeDisplay(read(editor).text) !== nativeDisplay(expected)) throw new Error('保存后的提示词或引用身份校验失败，已回退。');
      if (fingerprint(references(state.scope)) !== refFingerprint) throw new Error('保存期间参考图顺序变化，已回退。');
      state.lastUndo = { backup, text: read(editor).text, refs: refFingerprint };
      state.undo.disabled = false;
      report(state, `已绑定 ${count} 处引用 · 未开始生成`);
    } catch (error) {
      if (changed && backup && editor.isConnected) {
        restore(editor, backup);
        await turn();
      }
      report(state, error.message || String(error), true);
    } finally {
      state.busy = false;
      state.bind.disabled = false;
      state.undo.disabled = !state.lastUndo;
    }
  }

  function undo(state) {
    if (state.busy || !state.lastUndo) return;
    try {
      if (read(state.editor).text !== state.lastUndo.text || fingerprint(references(state.scope)) !== state.lastUndo.refs) {
        throw new Error('提示词或参考图已有后续修改；为保留新内容，未执行撤销。');
      }
      restore(state.editor, state.lastUndo.backup);
      state.lastUndo = null;
      state.undo.disabled = true;
      report(state, '已恢复绑定前的提示词 · 未开始生成');
    } catch (error) { report(state, error.message, true); }
  }

  function attach(editor) {
    if (states.has(editor)) return;
    const scope = scopeOf(editor);
    if (!scope) return;
    const panel = document.createElement('div');
    panel.className = 'libtv-numbered-at nodrag nopan';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'libtv-numbered-at-primary';
    button.textContent = '一键绑定 @';
    button.title = 'v1.0.4 · 支持 @image1、@图片 1、@图1；严格按参考编号绑定，不开始生成';
    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.textContent = '撤销本次绑定';
    undoButton.disabled = true;
    const status = document.createElement('span');
    status.className = 'libtv-numbered-at-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.append(button, undoButton, status);
    const anchor = editor.closest('.generator-prompt-scroll-region') || editor.parentElement;
    anchor.before(panel);
    const state = { editor, scope, panel, bind: button, undo: undoButton, status, busy: false, composing: false, lastUndo: null };
    states.set(editor, state);
    activeStates.add(state);
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    panel.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); void bind(state); });
    undoButton.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); undo(state); });
    editor.addEventListener('compositionstart', () => { state.composing = true; });
    editor.addEventListener('compositionend', () => { state.composing = false; });
    // Keep a user's concurrent keystroke from being overwritten by rollback.
    // Synthetic native-reference edits remain enabled during this short transaction.
    editor.addEventListener('beforeinput', e => {
      if (state.busy && e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    void strictMode(state).then(known => report(state, known ? '严格编号模式 · AutoLink 已关闭' : '请展开高级设置以检查 AutoLink')).catch(error => report(state, error.message, true));
  }

  function mount() {
    scheduled = false;
    for (const state of activeStates) {
      if (!state.editor.isConnected || !state.scope.isConnected) {
        state.panel.remove();
        activeStates.delete(state);
      } else if (!state.panel.isConnected) {
        const anchor = state.editor.closest('.generator-prompt-scroll-region') || state.editor.parentElement;
        anchor.before(state.panel);
      }
    }
    for (const editor of document.querySelectorAll(EDITOR)) if (visible(editor)) attach(editor);
  }

  new MutationObserver(() => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(mount); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();
