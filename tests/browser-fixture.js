(() => {
  const editor = document.querySelector('[contenteditable=true]');
  const refs = document.querySelector('.refs');
  const nativeCalls = [];
  let generationCount = 0;
  let pretendVideo = false;
  const colours = ['#446984', '#1d61ce', '#bec6cd'];
  for (let n = 1; n <= 3; n++) {
    const card = document.createElement('div'); card.className = 'card';
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="65" height="65"><rect width="65" height="65" rx="9" fill="${colours[n-1]}"/><text x="32" y="41" font-size="24" fill="white" text-anchor="middle">${n}</text></svg>`);
    const number = document.createElement('span'); number.textContent = String(n);
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label','@'); button.textContent='@';
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', () => {
      const selection = document.getSelection();
      if (!selection.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return;
      const range = selection.getRangeAt(0);
      const badge = document.createElement('span'); badge.className='mention-badge'; badge.contentEditable='false';
      badge.setAttribute('data-mention-type','mixed'); badge.setAttribute('data-mention-index',String(n)); badge.setAttribute('data-mention-node-id','i-fixture-'+n); badge.setAttribute('data-mention-media-type',pretendVideo && n === 2 ? 'video' : 'image');
      const thumb = img.cloneNode(); const label = document.createElement('span'); label.setAttribute('data-mention-label','true');label.textContent='图片 '+n; badge.append(thumb,label);
      const fragment=document.createDocumentFragment();fragment.append(document.createTextNode(' '),badge,document.createTextNode(' '));
      range.deleteContents();range.insertNode(fragment);range.setStartAfter(badge);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
      nativeCalls.push(n); editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));
    });
    card.append(img,number,button);refs.append(card);
  }
  document.getElementById('generate').addEventListener('click',()=>{generationCount++;document.getElementById('count').textContent='生成调用：'+generationCount;});
  const checks=document.getElementById('checks');
  const wait=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const bindButton=()=>document.querySelector('.libtv-numbered-at-primary');
  async function bind(){bindButton().click();for(let i=0;i<100&&bindButton().disabled;i++)await wait();if(bindButton().disabled)throw new Error('按钮操作超时');}
  function setText(text){editor.textContent=text;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));}
  function plain(){let text='';function walk(node){if(node.nodeType===3){text+=node.nodeValue;return;}if(node.nodeType!==1)return;if(node.hasAttribute('data-mention-type')){text+='@image'+node.getAttribute('data-mention-index');return;}if(node.tagName==='BR'){text+='\n';return;}for(const child of node.childNodes)walk(child);}walk(editor);return text;}
  function assert(ok,message){if(!ok)throw new Error(message);}
  document.getElementById('run-tests').addEventListener('click',async()=>{
    const run=document.getElementById('run-tests');run.disabled=true;checks.textContent='';let pass=0;
    async function test(name,fn){try{await fn();pass++;checks.textContent+='✓ '+name+'\n';}catch(e){checks.textContent+='✗ '+name+'：'+e.message+'\n';throw e;}}
    try{
      await test('严格模式自动关闭 AutoLink',async()=>{await wait();assert(!document.querySelector('[aria-label="智能引用 AutoLink"]').checked,'AutoLink 仍开启');});
      const original='办公室 @image1，角色 @image2 拿 @image3。\n再回到 @image1。';
      await test('重复、乱序、中文换行都绑定到准确的节点',async()=>{setText(original);await bind();assert(plain()===original,'原文发生改变');assert(editor.querySelectorAll('[data-mention-type]').length===4,'标签数量错误');assert(JSON.stringify(nativeCalls.slice(-3))==='[1,2,3]','原生模板读取顺序错误');});
      await test('重复点击保持幂等，不重复插入标签',async()=>{const html=editor.innerHTML;const count=nativeCalls.length;await bind();assert(editor.innerHTML===html&&nativeCalls.length===count,'重复绑定发生写入');});
      await test('撤销能准确恢复原文',async()=>{document.querySelector('.libtv-numbered-at button:nth-child(2)').click();assert(editor.querySelectorAll('[data-mention-type]').length===0&&plain()===original,'撤销未恢复');});
      await test('缺少编号整段停止，0 次原生引用操作',async()=>{setText('@image1 @image9');const html=editor.innerHTML;const count=nativeCalls.length;await bind();assert(editor.innerHTML===html&&nativeCalls.length===count,'越界后仍修改提示词');});
      await test('错误编号不会猜测替换',async()=>{setText('@image01 @image2');const html=editor.innerHTML;await bind();assert(editor.innerHTML===html,'错误编号被修改');});
      await test('图片类型不一致时回退整段',async()=>{setText('@image1 @image2');const html=editor.innerHTML;pretendVideo=true;await bind();pretendVideo=false;assert(editor.innerHTML===html,'视频类型未回退');});
      await test('后续已编辑时撤销不会覆盖新内容',async()=>{setText('@image1');await bind();editor.append(document.createTextNode(' 用户的新内容'));document.querySelector('.libtv-numbered-at button:nth-child(2)').click();assert(editor.textContent.includes('用户的新内容'),'撤销覆盖了后续内容');});
      const mixedOriginal='办公室 @图片 1，角色 @图2 拿 @image3。\n重复与乱序：@图片3、@图 1、@图片 2。';
      await test('中文与英文标记混用，重复乱序准确绑定',async()=>{setText(mixedOriginal);await bind();assert(plain()==='办公室 @image1，角色 @image2 拿 @image3。\n重复与乱序：@image3、@image1、@image2。','正文或编号发生改变');assert(JSON.stringify(Array.from(editor.querySelectorAll('[data-mention-type]'),e=>Number(e.getAttribute('data-mention-index'))))==='[1,2,3,3,1,2]','中文标记绑定错误');});
      await test('中文标记撤销恢复原来的写法及空格',async()=>{document.querySelector('.libtv-numbered-at button:nth-child(2)').click();assert(editor.textContent===mixedOriginal&&editor.querySelectorAll('[data-mention-type]').length===0,'中文原文未恢复');});
      await test('中文缺号预检停止，不调用任何原生引用按钮',async()=>{setText('@图片 1 @图9');const html=editor.innerHTML;const count=nativeCalls.length;await bind();assert(editor.innerHTML===html&&nativeCalls.length===count,'中文越界后仍修改提示词');});
      await test('生成按钮从未被触发',async()=>assert(generationCount===0,'触发了生成'));
      setText(mixedOriginal);await bind();document.getElementById('result').textContent=`${pass}/12 项验收通过`;document.getElementById('result').className='pass';
    }catch(e){document.getElementById('result').textContent='验收失败：'+e.message;document.getElementById('result').className='fail';}
    run.disabled=false;
  });
})();
