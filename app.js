const demoListings = [
  {id:'tp1',name:'大埔仔村屋 · 三房合租',district:'大埔仔',rent:5200,commute:18,term:12,deposit:2,source:'学长姐转租',status:'partial',note:'访谈示例：水电另计；通勤包含步行上山时间。',updated:'2026-11-13',bedrooms:'三房合租',people:'多人合租',utilities:'水电另计，金额待确认',image:'assets/building-district.svg'},
  {id:'hh1',name:'坑口屋苑 · 合租单间',district:'坑口',rent:6500,commute:42,term:12,deposit:2,source:'小红书',status:'draft',note:'访谈示例：经转租人联系，签约前需确认业主书面同意。',updated:'2026-11-12',bedrooms:'独立房间',people:'三人合租',utilities:'待向出租方确认',image:'assets/building-estate.svg'},
  {id:'pl1',name:'宝琳唐楼 · 四人合租',district:'宝琳',rent:5800,commute:31,term:12,deposit:2,source:'示例资料',status:'draft',note:'示例数据：实际租金、通勤与房源均需核实。',updated:'2026-11-10',bedrooms:'四人合租',people:'四人合租',utilities:'待向出租方确认',image:'assets/building-oldtown.svg'},
  {id:'ds1',name:'日新舍 · 双人房床位',district:'钻石山',rent:4000,commute:40,term:12,deposit:0,source:'学校统筹',status:'verified',note:'访谈示例：每床月租约 HK$4,000；受访者反馈通勤实际超过官方估算。',updated:'2026-11-08',bedrooms:'双人房床位',people:'两人房',utilities:'按住宿安排',image:'assets/building-dorm.svg'}
];

const statusText={verified:'学生已看房',partial:'部分确认',draft:'待核实'};
const statusClass={verified:'status-verified',partial:'status-partial',draft:'status-draft'};
const hongKongAreas=['中西区','湾仔区','东区','南区','油尖旺区','深水埗区','九龙城区','黄大仙区','观塘区','葵青区','荃湾区','屯门区','元朗区','北区','大埔区','沙田区','西贡区','离岛区','大埔仔','清水湾','西贡','坑口','将军澳','调景岭','宝琳','康城','彩虹','钻石山','牛池湾','九龙湾','蓝田','油塘'];
const storageKey='zhude-mingbai-local-v1';
const persisted=(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{return {}}})();
const persistedListings=Array.isArray(persisted.listings)?persisted.listings.filter(item=>item&&typeof item.id==='string'&&/^user-\d+$/.test(item.id)).map(item=>({...item,status:statusText[item.status]?item.status:'draft',image:''})):[];
const listings=[...demoListings,...persistedListings];
const validIds=new Set(listings.map(item=>item.id));
const state={saved:new Set(Array.isArray(persisted.saved)?persisted.saved.filter(id=>validIds.has(id)):[]),compared:new Set(),showSaved:false,view:matchMedia('(max-width: 600px)').matches?'cards':'table',draftImage:'',draftFile:null,ocrRun:0,toastTimer:0,lastOpener:null,ocrWorker:null,ocrPromise:null};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const money=value=>'HK$'+Number(value).toLocaleString('en-US');
const annualCost=item=>item.rent*12+(Number(item.deposit)||0)*item.rent;
const commuteText=item=>item.commute?`约 ${item.commute} 分钟`:'待补充';
const termText=item=>item.term?`${item.term} 个月`:'待补充';
const depositText=item=>item.deposit===null||item.deposit===''?'待补充':`押 ${item.deposit} 个月`;
const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function persistLocalData(){try{localStorage.setItem(storageKey,JSON.stringify({listings:listings.filter(item=>item.id.startsWith('user-')).map(({image,...item})=>item),saved:[...state.saved]}))}catch{}}

function iconIllustration(label='暂无截图'){
  return `<svg class="thumb-illustration" viewBox="0 0 120 100" role="img" aria-label="${escapeHTML(label)}"><rect x="18" y="27" width="84" height="54" rx="3" fill="#e7f0e9" stroke="#8cae99"/><path d="M14 82h92M26 27V18h68v9M36 38v31M60 38v31M84 38v31" fill="none" stroke="#39765a" stroke-width="2"/><path d="M18 57h84" fill="none" stroke="#b0c5b4"/></svg>`;
}
function thumb(item,large=false){
  if(item.image)return `<div class="property-thumb${large?' detail-image':''}"><img src="${escapeHTML(item.image)}" alt="示意图：建筑结构"><span class="thumb-badge">示意图</span></div>`;
  return `<div class="property-thumb${large?' detail-image':''}">${iconIllustration('示意图：暂无房源截图')}</div>`;
}
function statusChip(item){return `<span class="status ${statusClass[item.status]}">${statusText[item.status]}</span>`;}
function filteredListings(){
  const query=$('#searchInput').value.trim().toLowerCase(),district=$('#districtFilter').value,maxRent=$('#rentFilter').value;
  let result=listings.filter(item=>{
    const haystack=`${item.name} ${item.district} ${item.note} ${item.source}`.toLowerCase();
    return (!query||haystack.includes(query))&&(district==='all'||item.district===district)&&(!state.showSaved||state.saved.has(item.id))&&(maxRent==='all'||item.rent<=Number(maxRent));
  });
  const sort=$('#sortSelect').value;
  if(sort==='rent')result.sort((a,b)=>a.rent-b.rent);
  if(sort==='commute')result.sort((a,b)=>(Number(a.commute)||Infinity)-(Number(b.commute)||Infinity));
  if(sort==='updated')result.sort((a,b)=>b.updated.localeCompare(a.updated));
  if(sort==='recommended')result.sort((a,b)=>({verified:0,partial:1,draft:2}[a.status]-({verified:0,partial:1,draft:2}[b.status])||a.rent-b.rent));
  return result;
}
function setPage(page,updateHash=false){
  const active=page==='workspace'?'workspace':'guide';
  $$('[data-page]').forEach(section=>{const selected=section.dataset.page===active;section.hidden=!selected;section.classList.toggle('is-active',selected);});
  $$('[data-page-link]').forEach(link=>{const selected=link.dataset.pageLink===active;link.classList.toggle('is-active',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(updateHash&&location.hash!==`#${active}`)history.pushState(null,'',`#${active}`);
}
function syncPageFromHash(){setPage(location.hash==='#workspace'||location.hash==='#board'?'workspace':'guide');}
function renderEmpty(container,type){
  const copy={search:['没有找到匹配的房源','换个地区、屋苑或备注关键词试试。','清除搜索'],filters:['当前筛选没有房源','放宽预算或换一个区域，可以继续比较。','重置筛选'],saved:['还没有收藏房源','把看中的房源收藏起来，之后集中比较。','查看全部房源'],all:['看板还没有房源','添加第一张截图，开始整理你的租房资料。','添加房源截图']}[type];
  container.innerHTML=`${iconIllustration('空状态插图')}<strong>${copy[0]}</strong><p>${copy[1]}</p><button class="button button-quiet empty-action" type="button" data-empty-action="${type}">${copy[2]}</button>`;
}
function emptyType(){
  const query=$('#searchInput').value.trim(),filtered=filteredListings();
  if(filtered.length)return null;
  if(state.showSaved)return 'saved';
  if(query)return 'search';
  if($('#districtFilter').value!=='all'||$('#rentFilter').value!=='all')return 'filters';
  return 'all';
}
function row(item){
  const isSaved=state.saved.has(item.id),isCompared=state.compared.has(item.id);
  return `<tr><td><div class="property-cell">${thumb(item)}<div><div class="property-title">${escapeHTML(item.name)}</div><div class="property-sub"><span>${escapeHTML(item.district||'区域待补充')}</span><span>·</span><span class="source-tag">${escapeHTML(item.source||'来源待补充')}</span></div></div></div></td><td class="price-cell"><strong>${money(item.rent)}</strong><span>每人 / 月</span></td><td class="annual-cell"><strong>${money(annualCost(item))}</strong><span>租金 + 押金</span></td><td class="commute-cell"><strong>${commuteText(item)}</strong><span>单程 · 估算</span></td><td>${statusChip(item)}</td><td><div class="row-actions"><button class="text-action" type="button" data-action="detail" data-id="${item.id}">详情</button><button class="text-action${isSaved?' saved':''}" type="button" data-action="save" data-id="${item.id}" aria-pressed="${isSaved}">${isSaved?'已收藏':'收藏'}</button><label class="compare-check"><input type="checkbox" data-action="compare" data-id="${item.id}" ${isCompared?'checked':''}><span>比较</span></label></div></td></tr>`;
}
function card(item){
  const isSaved=state.saved.has(item.id),isCompared=state.compared.has(item.id);
  return `<article class="listing-card"><div>${thumb(item)}</div><div class="card-content"><div class="card-top"><div><div class="property-title">${escapeHTML(item.name)}</div><div class="property-sub">${escapeHTML(item.district||'区域待补充')} · ${escapeHTML(item.source||'来源待补充')}</div></div>${statusChip(item)}</div><div class="card-price">${money(item.rent)} <small>每人 / 月</small></div><div class="card-meta"><span>单程${commuteText(item)}</span><span>${termText(item)}</span><span>${depositText(item)}</span></div><div class="annual-line"><span>首年约</span><strong>${money(annualCost(item))}</strong><span>租金 + 押金</span></div><div class="card-bottom"><button class="text-action" type="button" data-action="detail" data-id="${item.id}">查看资料</button><div class="row-actions"><button class="text-action${isSaved?' saved':''}" type="button" data-action="save" data-id="${item.id}" aria-pressed="${isSaved}">${isSaved?'已收藏':'收藏'}</button><label class="compare-check"><input type="checkbox" data-action="compare" data-id="${item.id}" ${isCompared?'checked':''}><span>比较</span></label></div></div></div></article>`;
}
function filtersSummary(){
  const chips=[];
  if($('#districtFilter').value!=='all')chips.push(`区域：${escapeHTML($('#districtFilter').value)}`);
  if($('#rentFilter').value!=='all')chips.push(`预算：${escapeHTML($('#rentFilter').selectedOptions[0].text)}`);
  if(state.showSaved)chips.push('仅看收藏');
  $('#activeFilters').innerHTML=chips.map(text=>`<span class="filter-chip">${text}</span>`).join('');
}
function render(){
  const result=filteredListings(),empty=emptyType(),table=$('#tableView'),cards=$('#cardView');
  $('#resultCount').textContent=result.length;
  $('#resultAnnouncement').textContent=state.showSaved?`当前显示 ${result.length} 条已收藏房源`:`当前显示 ${result.length} 条房源`;
  $('#savedCount').textContent=state.saved.size;
  $('#savedNavLabel').textContent=state.showSaved?'查看全部':'我的收藏';
  $('#savedFilter').setAttribute('aria-pressed',String(state.showSaved));
  $$('.view-toggle').forEach(button=>{const selected=button.dataset.view===state.view;button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));});
  filtersSummary();
  if(state.view==='table'){
    table.hidden=false;cards.hidden=true;
    if(empty){table.querySelector('.table-scroll').hidden=true;renderEmpty($('#tableEmpty'),empty);$('#tableEmpty').hidden=false;}else{table.querySelector('.table-scroll').hidden=false;$('#tableEmpty').hidden=true;$('#listingRows').innerHTML=result.map(row).join('');}
  }else{
    table.hidden=true;cards.hidden=false;
    if(empty){cards.innerHTML='';renderEmpty(cards,empty);}else cards.innerHTML=result.map(card).join('');
  }
  renderCompareDock();
}
function renderCompareDock(){
  const dock=$('#compareDock');dock.hidden=state.compared.size===0;document.body.classList.toggle('has-compare-dock',state.compared.size>0);$('#compareCount').textContent=state.compared.size;$('#compareSelected').innerHTML=[...state.compared].map(id=>listings.find(item=>item.id===id)).filter(Boolean).map(item=>`<span class="compare-pill">${escapeHTML(item.name)}</span>`).join('');$('#compareButton').disabled=state.compared.size<2;
}
function openModal(dialog,opener){state.lastOpener=opener||document.activeElement;dialog.showModal();requestAnimationFrame(()=>dialog.querySelector('.icon-button')?.focus());}
function closeModal(dialog){if(dialog.open)dialog.close();requestAnimationFrame(()=>state.lastOpener?.focus?.());}
function openDetail(id,opener){
  const item=listings.find(entry=>entry.id===id);if(!item)return;
  $('#detailTitle').textContent=item.name;
  $('#detailBody').innerHTML=`<div class="detail-hero">${thumb(item,true)}<div><div class="detail-price">${money(item.rent)} <small>每人 / 月</small></div><div class="detail-sub">${escapeHTML(item.district||'区域待补充')} · ${escapeHTML(item.source||'来源待补充')}</div><div class="detail-status">${statusChip(item)}</div></div></div><div class="detail-fields">${[['单程通勤',`${commuteText(item)}（估算）`],['首年约',money(annualCost(item))],['房型',item.bedrooms||'待补充'],['面积',item.area||'待补充'],['入住人数',item.people||'待补充'],['租期',termText(item)],['押金',depositText(item)],['水电',item.utilities||'待确认'],['最近更新',item.updated||'待补充']].map(([label,value])=>`<div class="detail-field"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div><p class="detail-note">${escapeHTML(item.note||'暂无备注')}</p><p class="detail-caveat">通勤与费用资料仍需按实际地址、时段和租约核实。状态不代表平台担保。</p>`;
  openModal($('#detailModal'),opener);
}
function openCompare(opener){
  const items=[...state.compared].map(id=>listings.find(item=>item.id===id)).filter(Boolean);if(items.length<2)return;
  const fields=[['月租 / 人',item=>item.rent,'min'],['首年约',item=>annualCost(item),'min'],['单程通勤',item=>item.commute,'min'],['区域',item=>item.district||'待补充'],['房型',item=>item.bedrooms||'待补充'],['租期',item=>termText(item)],['押金',item=>item.deposit,'min'],['资料状态',item=>statusText[item.status]],['来源与备注',item=>`${item.source||'来源待补充'}；${item.note||'暂无备注'}`]];
  $('#compareTable').innerHTML=`<table class="compare-table"><caption>比较项目与当前选择</caption><thead><tr><th scope="col">比较项目</th>${items.map(item=>`<th scope="col">${escapeHTML(item.name)}</th>`).join('')}</tr></thead><tbody>${fields.map(([label,getValue,mode])=>{const values=items.map(getValue),known=values.filter(value=>typeof value==='number'&&Number.isFinite(value)),best=mode==='min'&&known.length?Math.min(...known):null;return `<tr><th scope="row">${label}</th>${items.map((item,index)=>{const value=values[index],isNumeric=typeof value==='number'&&Number.isFinite(value),isBest=mode==='min'&&isNumeric&&value===best,display=mode==='min'&&!isNumeric?'待补充':mode==='min'?(label==='月租 / 人'?money(value):label==='首年约'?money(value):label==='单程通勤'?`约 ${value} 分钟`:label==='押金'?`${value} 个月`:String(value)):value;return `<td class="${isBest?'is-best':''}">${escapeHTML(display)}${isBest?'<span class="best-mark">相对更低</span>':''}</td>`}).join('')}</tr>`}).join('')}</tbody></table>`;
  openModal($('#compareModal'),opener);
}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);}
function setUploadStatus(message){$('#uploadStatus').textContent=message;}
function setOCRProgress(message,progress){
  const panel=$('#ocrProgress'),bar=$('#ocrProgressBar');panel.hidden=false;$('#ocrProgressText').textContent=message;
  panel.dataset.complete=String(progress===1&&message.startsWith('识别完成'));
  if(Number.isFinite(progress)){bar.hidden=false;bar.value=Math.max(0,Math.min(1,progress));}else{bar.hidden=true;}
}
function parseOCRText(text){return RentalOCR.parse(text,hongKongAreas);}
function applyOCRFields(parsed){
  const form=$('#listingForm');
  for(const key of ['name','rent','commute','term','deposit','bedrooms','area','source','note'])if(parsed[key]&&(!form.elements[key].value||key==='source'&&form.elements[key].value==='未注明'))form.elements[key].value=parsed[key];
  if(parsed.district&&!form.elements.district.value)form.elements.district.value=parsed.district;
  $('#ocrText').textContent=parsed.raw||'';
  $('#ocrTextPanel').hidden=!parsed.raw;
  const found=parsed.found.length?`识别到：${parsed.found.join('、')}。`:'未找到明确的房源字段。';
  const missing=parsed.raw&&parsed.missing?.length?`截图中未识别到${parsed.missing.join('、')}，请补充。`:'';
  $('#draftNote').textContent=found+missing+' 保存前请核对识别结果。';
}
async function prepareOCRImage(file){
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(2,Math.max(1,2200/bitmap.width),3800/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const image=context.getImageData(0,0,canvas.width,canvas.height),pixels=image.data;
    for(let i=0;i<pixels.length;i+=4){const grey=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];const value=Math.max(0,Math.min(255,(grey-128)*1.18+128));pixels[i]=pixels[i+1]=pixels[i+2]=value;}
    context.putImageData(image,0,0);
    return canvas;
  }finally{bitmap.close();}
}
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(state.ocrPromise)return state.ocrPromise;
  state.ocrPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';script.async=true;script.crossOrigin='anonymous';
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR 程序未能启动'));
    script.onerror=()=>reject(new Error('无法载入 OCR 程序，请检查网络后重试'));
    document.head.append(script);
  }).catch(error=>{state.ocrPromise=null;throw error;});
  return state.ocrPromise;
}
let ocrWorkerPromise=null;
let ocrQueue=Promise.resolve();
async function getOCRWorker(Tesseract){
  if(state.ocrWorker)return state.ocrWorker;
  if(!ocrWorkerPromise)ocrWorkerPromise=Tesseract.createWorker('chi_sim+chi_tra+eng',1,{logger:message=>{
    if(state.ocrActiveRun!==state.ocrRun)return;
    if(message.status==='loading tesseract core')setOCRProgress('正在准备本地识别程序…',message.progress);
    else if(message.status==='loading language traineddata')setOCRProgress('首次使用：正在下载简体、繁体与英文模型…',message.progress);
    else if(message.status==='initializing api')setOCRProgress('正在初始化简繁中文识别…',message.progress);
    else if(message.status==='recognizing text')setOCRProgress('正在识别简体、繁体与英文…',message.progress);
  }}).then(async worker=>{
    await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
    state.ocrWorker=worker;return worker;
  }).catch(error=>{ocrWorkerPromise=null;throw error;});
  return ocrWorkerPromise;
}
function recognizeImage(file,run){
  const task=async()=>{
    if(run!==state.ocrRun)return;
    state.ocrActiveRun=run;
    try{
      setOCRProgress('正在载入简体、繁体与英文识别程序…');
      const Tesseract=await loadTesseract();
      if(run!==state.ocrRun)return;
      const worker=await getOCRWorker(Tesseract);
      if(run!==state.ocrRun)return;
      setOCRProgress('正在增强截图文字…');
      const image=await prepareOCRImage(file);
      if(run!==state.ocrRun)return;
      const result=await worker.recognize(image);
      if(run!==state.ocrRun)return;
      let raw=result.data.text||'';
      if(image.width/image.height>1.5&&!parseOCRText(raw).area){
        setOCRProgress('正在检查右侧图片与说明文字…');
        const column=document.createElement('canvas');
        const left=Math.round(image.width*.52);
        column.width=image.width-left;column.height=image.height;
        const context=column.getContext('2d',{willReadFrequently:true});
        context.drawImage(image,left,0,column.width,image.height,0,0,column.width,column.height);
        // Isolate light captions on photos; the main pass already reads dark text.
        const captions=context.getImageData(0,0,column.width,column.height);
        for(let i=0;i<captions.data.length;i+=4){const value=captions.data[i]>225?0:255;captions.data[i]=captions.data[i+1]=captions.data[i+2]=value;}
        context.putImageData(captions,0,0);
        const extra=await worker.recognize(column);
        if(run!==state.ocrRun)return;
        if(extra.data.text?.trim())raw+='\n'+extra.data.text;
      }
      const parsed={...parseOCRText(raw),raw};
      applyOCRFields(parsed);
      setOCRProgress(parsed.found.length?`识别完成，找到 ${parsed.found.length} 项候选资料。`:'已读取文字，未找到明确字段；可查看原文或手动填写。',1);
      $('#ocrRetryButton').hidden=false;
      $('#ocrRetryButton').textContent='重新识别';
    }catch(error){
      console.warn('Browser OCR unavailable:',error);
      if(run!==state.ocrRun)return;
      if(state.ocrWorker){state.ocrWorker.terminate().catch(()=>{});state.ocrWorker=null;}
      ocrWorkerPromise=null;
      setOCRProgress(`${error.message||'OCR 暂不可用'}。请检查网络后重试，或继续手动填写。`);
      $('#draftNote').textContent='识别未完成，已填写的资料会保留。';
      $('#ocrRetryButton').hidden=false;$('#ocrRetryButton').textContent='重试识别';
    }
  };
  ocrQueue=ocrQueue.then(task,task);
  return ocrQueue;
}
function addImageFiles(files){
  const list=[...files];if(list.length>1)showToast('已选择多张图片，只使用第一张');const image=list.find(file=>file.type.startsWith('image/'));
  if(!image){setUploadStatus('没有找到图片文件，请选择 JPG、PNG 或 WEBP。');showToast('请选择图片格式的房源截图');return;}
  if(image.size>12*1024*1024){setUploadStatus('图片超过 12 MB，请先压缩截图后再上传。');showToast('图片过大，请选择小于 12 MB 的截图');return;}
  state.ocrRun++;
  if(state.draftImage)URL.revokeObjectURL(state.draftImage);state.draftImage=URL.createObjectURL(image);state.draftFile=image;$('#draftPreview').innerHTML=`<img src="${escapeHTML(state.draftImage)}" alt="待识别的本地房源截图">`;
  const form=$('#listingForm');form.reset();form.elements.name.value='';form.elements.district.value='';form.elements.rent.value='';form.elements.commute.value='';form.elements.term.value='';form.elements.deposit.value='';form.elements.source.value='未注明';$('#ocrProgress').hidden=true;$('#ocrRetryButton').hidden=true;$('#ocrTextPanel').hidden=true;$('#ocrText').textContent='';$('#draftNote').textContent=`已载入 ${image.name}。为保护隐私，请确认截图中没有未遮盖的姓名、电话或微信号。`;
  openModal($('#uploadModal'),$('#chooseFileButton'));const run=state.ocrRun;recognizeImage(image,run);
}
function discardDraft(){state.ocrRun++;if(state.draftImage)URL.revokeObjectURL(state.draftImage);state.draftImage='';state.draftFile=null;$('#draftPreview').innerHTML='<span>等待截图预览</span>';$('#ocrProgress').hidden=true;$('#ocrRetryButton').hidden=true;$('#ocrTextPanel').hidden=true;$('#ocrText').textContent='';$('#listingForm').reset();}
function handleUpload(event){addImageFiles(event.target.files);event.target.value='';}
function resetFilters(){ $('#searchInput').value='';$('#districtFilter').value='all';$('#rentFilter').value='all';$('#sortSelect').value='recommended';state.showSaved=false;render(); }
function handleListingAction(event){const button=event.target.closest('[data-action="detail"],[data-action="save"]');if(!button)return;const {action,id}=button.dataset;if(action==='detail')openDetail(id,button);if(action==='save'){if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);persistLocalData();render();showToast(state.saved.has(id)?'已加入收藏':'已取消收藏');}}
function handleCompareChange(event){const input=event.target.closest('input[data-action="compare"]');if(!input)return;const id=input.dataset.id;if(input.checked&&state.compared.size>=3){input.checked=false;showToast('最多同时比较 3 套房源');return;}if(input.checked)state.compared.add(id);else state.compared.delete(id);render();}
function bind(){
  document.addEventListener('click',event=>{const link=event.target.closest('[data-page-link],a[href="#workspace"],a[href="#guide"]');if(!link)return;const page=link.getAttribute('href')==='#guide'?'guide':'workspace';event.preventDefault();setPage(page,true);window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  window.addEventListener('hashchange',syncPageFromHash);window.addEventListener('popstate',syncPageFromHash);
  ['searchInput','districtFilter','rentFilter','sortSelect'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',render));
  $('#clearFilters').addEventListener('click',resetFilters);$('#savedFilter').addEventListener('click',()=>{state.showSaved=!state.showSaved;render();setPage('workspace',true);$('#board').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  $$('.view-toggle').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.view;render();}));$('#listingRows').addEventListener('click',handleListingAction);$('#cardView').addEventListener('click',handleListingAction);$('#listingRows').addEventListener('change',handleCompareChange);$('#cardView').addEventListener('change',handleCompareChange);
  $('#chooseFileButton').addEventListener('click',()=>$('#fileInput').click());$('#fileInput').addEventListener('change',handleUpload);
  $('#ocrRetryButton').addEventListener('click',()=>{if(!state.draftFile)return;state.ocrRun++;$('#ocrRetryButton').hidden=true;recognizeImage(state.draftFile,state.ocrRun);});
  const drop=$('#dropZone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('is-over');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('is-over');}));drop.addEventListener('drop',event=>addImageFiles(event.dataTransfer.files));
  document.addEventListener('paste',event=>{const image=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'));if(image){const file=image.getAsFile();if(file)addImageFiles([file]);}});
  $('#pasteButton').addEventListener('click',async()=>{try{if(!navigator.clipboard?.read)throw new Error('paste');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(type){addImageFiles([await item.getType(type)]);return;}}setUploadStatus('剪贴板里没有图片，也可以按 Ctrl / ⌘ + V 粘贴截图。');showToast('剪贴板里没有图片');}catch{setUploadStatus('请先复制截图，再按 Ctrl / ⌘ + V 粘贴。');showToast('请先复制截图，再粘贴');}});
  $('#listingForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),status=data.get('status');listings.unshift({id:`user-${Date.now()}`,name:data.get('name').trim(),district:data.get('district')||'其他',rent:Number(data.get('rent')),commute:data.get('commute')?Number(data.get('commute')):null,term:data.get('term')?Number(data.get('term')):null,deposit:data.get('deposit')?Number(data.get('deposit')):null,source:data.get('source'),status,note:data.get('note').trim()||'用户添加的房源；请在签约前自行核实。',updated:new Date().toISOString().slice(0,10),bedrooms:data.get('bedrooms').trim()||'待补充',area:data.get('area').trim(),people:'待补充',utilities:'待确认',image:state.draftImage});persistLocalData();state.draftImage='';state.draftFile=null;event.currentTarget.reset();closeModal($('#uploadModal'));resetFilters();$('#board').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});showToast('房源已加入当前看板');});
  $('#compareButton').addEventListener('click',event=>openCompare(event.currentTarget));$('#clearCompare').addEventListener('click',()=>{state.compared.clear();render();});$('#methodButton').addEventListener('click',event=>openModal($('#methodModal'),event.currentTarget));$('#boardMethodButton').addEventListener('click',event=>openModal($('#methodModal'),event.currentTarget));
  document.addEventListener('click',event=>{const button=event.target.closest('[data-empty-action]');if(!button)return;const action=button.dataset.emptyAction;if(action==='search'){$('#searchInput').value='';render();$('#searchInput').focus();}else if(action==='saved'){state.showSaved=false;render();}else if(action==='all'||action==='filters'){resetFilters();}});
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal($('#'+button.dataset.close))));$$('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target===dialog)closeModal(dialog)});dialog.addEventListener('close',()=>{if(dialog.id==='uploadModal')discardDraft();if(state.lastOpener?.isConnected)state.lastOpener.focus();});});
}

bind();render();syncPageFromHash();
