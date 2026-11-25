const demoListings = [
  {id:'tp1',name:'大埔仔村屋 · 三房合租',district:'大埔仔',rawRent:5200,rentUnit:'每床',commute:18,term:12,depositMonths:2,source:'学长姐转租',status:'partial',note:'访谈示例：水电另计；通勤包含步行上山时间。',updated:'2026-11-13',bedrooms:'三房合租',utilities:'水电另计，金额待确认',verificationItems:'水电金额待确认',image:'assets/demo-village-house.webp',imageDescription:'大埔仔村屋示意图，斜坡旁带露台的三层村屋'},
  {id:'hh1',name:'坑口屋苑 · 合租单间',district:'坑口',rawRent:6500,rentUnit:'每房',people:1,commute:42,term:12,depositMonths:2,source:'小红书',status:'draft',note:'访谈示例：经转租人联系。',updated:'2026-11-12',bedrooms:'独立房间',verificationItems:'业主书面同意待确认',image:'assets/demo-estate-room.webp',imageDescription:'坑口屋苑合租单间示意图，房内有一张单人床和书桌'},
  {id:'pl1',name:'宝琳唐楼 · 四人合租',district:'宝琳',rawRent:5800,rentUnit:'每床',commute:31,term:12,depositMonths:2,source:'示例资料',status:'draft',note:'示例数据：实际租金、通勤与房源均需核实。',updated:'2026-11-10',bedrooms:'四人合租',image:'assets/demo-tong-lau.webp',imageDescription:'宝琳唐楼示意图，带铁窗花和小阳台的旧式楼房'},
  {id:'ds1',name:'日新舍 · 双人房床位',district:'钻石山',rawRent:4000,rentUnit:'每床',people:1,commute:40,term:12,depositMonths:0,source:'访谈示例',status:'verified',note:'受访者反馈实际通勤超过原先估算。',updated:'2026-11-08',bedrooms:'双人房床位',utilities:'按住宿安排',image:'assets/demo-twin-room.webp',imageDescription:'双人住宿房示意图，窗边有两张单人床和两张书桌'},
  {id:'ppt1',name:'两人合租 · 整套报价示例',rawRent:14000,rentUnit:'整套',people:2,term:9,depositMonths:2,intermediaryFee:0,commute:30,source:'PPT 演示资料',status:'draft',note:'整套报价与费用拆分示例。',updated:'2026-11-20',bedrooms:'整套合租',verificationItems:'转租授权待确认',image:'assets/demo-shared-flat.webp',imageDescription:'两人合租整套示意图，两间独立卧室共用客厅和厨房'}
];

const statusText={verified:'学生已看房',partial:'部分确认',draft:'待核实'};
const statusClass={verified:'status-verified',partial:'status-partial',draft:'status-draft'};
const statusRank={verified:0,partial:1,draft:2};
const unknown='待确认';
const {fields:costFields,withFees}=RentalFees;
const feeFields=[...costFields,'commute','verificationItems'];
const hongKongAreas=['中西区','湾仔区','东区','南区','油尖旺区','深水埗区','九龙城区','黄大仙区','观塘区','葵青区','荃湾区','屯门区','元朗区','北区','大埔区','沙田区','西贡区','离岛区','大埔仔','清水湾','西贡','坑口','将军澳','调景岭','宝琳','康城','彩虹','钻石山','牛池湾','九龙湾','蓝田','油塘'];
const storageKey='zhude-mingbai-local-v1';
const persisted=(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')??{}}catch{return {}}})();
const persistedListings=Array.isArray(persisted.listings)?persisted.listings
  .filter(item=>item&&typeof item.id==='string'&&/^user-\d+$/.test(item.id))
  .map(({rent,deposit,...item})=>{
    // The old form recorded rent and deposit months on a per-person basis.
    const legacy=Object.hasOwn(item,'rawRent')?{}:{rawRent:rent,rentUnit:'每床',people:null,depositMonths:deposit};
    return {...item,...legacy,status:Object.hasOwn(statusText,item.status)?item.status:'draft',image:''};
  }):[];
const listings=[...demoListings,...persistedListings].map(withFees);
const validIds=new Set(listings.map(item=>item.id));
const state={saved:new Set(Array.isArray(persisted.saved)?persisted.saved.filter(id=>validIds.has(id)):[]),compared:new Set(),showSaved:false,view:matchMedia('(max-width: 600px)').matches?'cards':'table',draftImage:'',draftFile:null,editingId:null,ocrRun:0,toastTimer:0,ocrWorker:null,ocrPromise:null};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const money=value=>Number.isFinite(value)?'HK$'+value.toLocaleString('en-US',{maximumFractionDigits:2}):unknown;
const minutes=value=>Number.isFinite(value)?`约 ${value} 分钟`:unknown;
const months=value=>Number.isFinite(value)?`${value} 个月`:unknown;
const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function utilityText(item){
  if(item.utilityUnit==='included')return '已包水电';
  if(item.utilityShare===null)return item.utilityUnit==='shared'&&item.utilityAmount!==null?'分摊人数待确认':'待确认';
  return money(item.utilityShare)+'/月';
}

function termCostText(item){
  if(item.termTotal!==null)return money(item.termTotal);
  if(item.knownTermCost===null)return '待确认';
  return money(item.knownTermCost)+'（未含'+item.termMissing.join('、')+'）';
}

function termFeeDetails(item){
  return [['每人每月水电',utilityText(item)],['其他每月费用（每人）',item.otherMonthly===null?'未录入':money(item.otherMonthly)],
    ['其他入住费用（每人）',item.otherUpfront===null?'未录入':money(item.otherUpfront)],
    ['月均预计支出（每人）',money(item.averageMonthly)]];
}

function verificationText(item){
  const items=item.verificationItems?[item.verificationItems]:[];
  if(item.rawRent===null)items.push('原始报价待确认');
  if(!item.rentUnit)items.push('报价单位待确认');
  if(item.rentUnit==='每房'&&!item.people)items.push('每房分摊人数待确认');
  if(item.rentUnit==='整套'&&!item.people)items.push('整套分摊人数待确认');
  if(item.conflictingDeposit)items.push('押金月数与金额不一致，请核对');
  else if(item.depositMonths===null&&item.depositAmount===null)items.push('押金待确认');
  if(item.intermediaryFee===null)items.push('中介费待确认');
  if(item.term===null)items.push('租期待确认');
  if(item.utilityShare===null&&!items.some(text=>text.includes('水电')))items.push('水电费待确认');
  if(item.conflictingAdvance)items.push('预付租金月数超过租期');
  if(item.commute===null)items.push('单程通勤待确认');
  return [...new Set(items)].join('、')||'暂无已记录事项';
}

const feeText=(item,key)=>key==='termTotal'?termCostText(item):money(item[key]);

const personFees=[
  ['入住前须付','upfrontCost'],
  ['租期预计总支出','termTotal'],
  ['可退押金','refundableDeposit']
];

function persistLocalData(){try{localStorage.setItem(storageKey,JSON.stringify({listings:listings.filter(item=>item.id.startsWith('user-')).map(({image,...item})=>item),saved:[...state.saved]}))}catch{}}

function thumb(item,large=false){
  const sizeClass=large?' detail-image':'';
  if(item.image){
    const isScreenshot=item.image.startsWith('blob:');
    const label=isScreenshot?'会话截图':'示意图';
    const kindClass=isScreenshot?'':' property-illustration';
    const alt=isScreenshot?'房源截图':item.imageDescription;
    return `<div class="property-thumb${sizeClass}${kindClass}"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(alt)}"><span class="thumb-badge" aria-hidden="true">${label}</span></div>`;
  }
  return `<div class="property-thumb property-placeholder${sizeClass}"><span>暂无截图</span></div>`;
}
function statusChip(item){return `<span class="status ${statusClass[item.status]}">${statusText[item.status]}</span>`;}
function filteredListings(){
  const query=$('#searchInput').value.trim().toLowerCase(),district=$('#districtFilter').value,maxRent=$('#rentFilter').value;
  let result=listings.filter(item=>{
    const haystack=`${item.name} ${item.district??''} ${item.note} ${item.source} ${item.verificationItems}`.toLowerCase();
    const withinBudget=maxRent==='all'||(item.rentPerPerson!==null&&item.rentPerPerson<=Number(maxRent));
    return (!query||haystack.includes(query))&&(district==='all'||item.district===district)&&(!state.showSaved||state.saved.has(item.id))&&withinBudget;
  });
  const sort=$('#sortSelect').value;
  const byRent=(a,b)=>(a.rentPerPerson??Infinity)-(b.rentPerPerson??Infinity);
  if(sort==='rent')result.sort(byRent);
  if(sort==='commute')result.sort((a,b)=>(a.commute??Infinity)-(b.commute??Infinity));
  if(sort==='updated')result.sort((a,b)=>b.updated.localeCompare(a.updated));
  if(sort==='status')result.sort((a,b)=>statusRank[a.status]-statusRank[b.status]||byRent(a,b));
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
  container.innerHTML=`<img class="empty-illustration" src="assets/guide-house.png" alt=""><strong>${copy[0]}</strong><p>${copy[1]}</p><button class="button button-quiet empty-action" type="button" data-empty-action="${type}">${copy[2]}</button>`;
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
  return `<tr><td><button type="button" class="property-cell property-link" data-action="detail" data-id="${item.id}">${thumb(item)}<span><span class="property-title">${escapeHTML(item.name)}</span><span class="property-sub"><span>${escapeHTML(item.district||'区域待确认')}</span><span class="source-tag">${escapeHTML(item.source||'来源待确认')}</span></span></span></button></td>
    <td class="price-cell"><strong>${money(item.rentPerPerson)}</strong></td>
    ${personFees.map(([,key])=>`<td class="fee-cell"><strong>${feeText(item,key)}</strong></td>`).join('')}
    <td class="commute-cell"><strong>${minutes(item.commute)}</strong></td>
    <td>${statusChip(item)}</td><td class="verification-cell">${escapeHTML(verificationText(item))}</td>
    <td><div class="row-actions"><button class="text-action" type="button" data-action="detail" data-id="${item.id}">详情</button><button class="text-action${isSaved?' saved':''}" type="button" data-action="save" data-id="${item.id}" aria-pressed="${isSaved}">${isSaved?'已收藏':'收藏'}</button><label class="compare-check"><input type="checkbox" data-action="compare" data-id="${item.id}" ${isCompared?'checked':''}><span>比较</span></label></div></td></tr>`;
}

function fieldList(fields,className){
  return `<dl class="${className}">${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
}

function card(item){
  const isSaved=state.saved.has(item.id),isCompared=state.compared.has(item.id);
  return `<article class="listing-card"><div>${thumb(item)}</div><div class="card-content"><div class="card-top"><div><div class="property-title">${escapeHTML(item.name)}</div><div class="property-sub">${escapeHTML(item.district||'区域待确认')} · ${escapeHTML(item.source||'来源待确认')}</div></div>${statusChip(item)}</div><div class="card-price">${money(item.rentPerPerson)} <small>每人月租</small></div>
    ${fieldList([['入住前须付',money(item.upfrontCost)],['单程通勤',minutes(item.commute)]],'card-fees')}
    <div class="card-bottom"><button class="text-action" type="button" data-action="detail" data-id="${item.id}">查看资料</button><div class="row-actions"><button class="text-action${isSaved?' saved':''}" type="button" data-action="save" data-id="${item.id}" aria-pressed="${isSaved}">${isSaved?'已收藏':'收藏'}</button><label class="compare-check"><input type="checkbox" data-action="compare" data-id="${item.id}" ${isCompared?'checked':''}><span>比较</span></label></div></div></div></article>`;
}
function filtersSummary(){
  const chips=[];
  if($('#districtFilter').value!=='all')chips.push(`区域：${escapeHTML($('#districtFilter').value)}`);
  if($('#rentFilter').value!=='all')chips.push(`预算：${escapeHTML($('#rentFilter').selectedOptions[0].text)}`);
  if(state.showSaved)chips.push('仅看收藏');
  $('#activeFilters').innerHTML=chips.map(text=>`<span class="filter-chip">${text}</span>`).join('');
}
function render(){
  const focusedAction=document.activeElement?.dataset;
  const result=filteredListings(),empty=emptyType(),table=$('#tableView'),cards=$('#cardView');
  $('#resultCount').textContent=result.length;
  $('#resultAnnouncement').textContent=state.showSaved?`当前显示 ${result.length} 条已收藏房源`:`当前显示 ${result.length} 条房源`;
  $('#savedCount').textContent=state.saved.size;
  $('#savedNavLabel').textContent=state.showSaved?'查看全部':'我的收藏';
  $('#savedFilter').setAttribute('aria-label',state.showSaved?'查看全部':'我的收藏');
  $('#savedFilter').setAttribute('aria-pressed',String(state.showSaved));
  const sortHelp={
    status:'依次显示学生已看房、部分确认、待核实。同状态按每人月租从低到高，月租待确认的排在该组末尾。',
    rent:'按每人月租从低到高排列，月租待确认的排在末尾。',
    commute:'按单程通勤从短到长排列，通勤待确认的排在末尾。',
    updated:'按最近更新日期排列。'
  };
  $('#sortExplanation').textContent=sortHelp[$('#sortSelect').value];
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
  if(focusedAction?.id&&focusedAction.action){
    const view=state.view==='table'?table:cards;
    const replacement=$$('[data-action]',view).find(control=>control.dataset.id===focusedAction.id&&control.dataset.action===focusedAction.action);
    if(replacement&&!view.querySelector('.empty-state:not([hidden])'))replacement.focus({preventScroll:true});
    else if(state.showSaved)$('#savedFilter').focus({preventScroll:true});
  }
}
function renderCompareDock(){
  const dock=$('#compareDock');dock.hidden=state.compared.size===0;document.body.classList.toggle('has-compare-dock',state.compared.size>0);$('#compareCount').textContent=state.compared.size;$('#compareSelected').innerHTML=[...state.compared].map(id=>listings.find(item=>item.id===id)).filter(Boolean).map(item=>`<span class="compare-pill">${escapeHTML(item.name)}</span>`).join('');$('#compareButton').disabled=state.compared.size<2;
}
const dialogOpeners=new WeakMap();
function openModal(dialog,opener){
  if(dialog.open)return;
  dialogOpeners.set(dialog,opener||document.activeElement);
  dialog.scrollTop=0;
  dialog.showModal();
  dialog.querySelector('.icon-button')?.focus();
}
function closeModal(dialog){if(dialog.open)dialog.close();}
function openDetail(id,opener){
  const item=listings.find(entry=>entry.id===id);if(!item)return;
  $('#detailTitle').textContent=item.name;
  const fields=[['入住前须付（每人）',money(item.upfrontCost)],['单程通勤',minutes(item.commute)],
    ['租期预计总支出（每人）',termCostText(item)],['租期',months(item.term)]];
  const breakdown=[['备注',item.note||unknown],['可退押金（每人）',money(item.refundableDeposit)],...termFeeDetails(item),
    ['预付租金（每人）',money(item.prepaidRent)],['中介费（每人）',money(item.feeShare)],
    ['原始月租报价',money(item.rawRent)],['报价单位',item.rentUnit||unknown],
    ['分摊人数',item.rentUnit==='每床'?'每床按 1 人':item.people?`${item.people} 人`:unknown],
    ['押金月数',months(item.depositMonths)],['押金金额（报价单位）',money(item.totalDeposit)],['中介费（报价单位）',money(item.intermediaryFee)],
    ['房型',item.bedrooms||unknown],['面积',item.area||unknown],['水电',item.utilities||unknown],['最近更新',item.updated||unknown]];
  $('#detailBody').innerHTML=`<div class="detail-hero">${thumb(item,true)}<div><div class="detail-price">${money(item.rentPerPerson)} <small>每人月租</small></div><div class="detail-sub">${escapeHTML(item.district||'区域待确认')} · ${escapeHTML(item.source||'来源待确认')}</div><div class="detail-status">${statusChip(item)}</div></div></div>
    ${fieldList(fields,'detail-fields')}
    ${fieldList([['待核对事项',verificationText(item)]],'detail-verification')}
    <details class="detail-more"><summary>更多费用与房源资料</summary>${fieldList(breakdown,'detail-fields')}</details>`;
  if(item.id.startsWith('user-')){
    const editButton=document.createElement('button');
    editButton.type='button';
    editButton.className='button button-quiet detail-edit';
    editButton.textContent='编辑房源资料';
    editButton.addEventListener('click',()=>editListing(item,editButton));
    $('#detailBody').prepend(editButton);
  }
  openModal($('#detailModal'),opener);
}

function openCompare(opener){
  const items=[...state.compared].map(id=>listings.find(item=>item.id===id)).filter(Boolean);if(items.length<2)return;
  const sameTerm=items[0].term!==null&&items.every(item=>item.term===items[0].term);
  const missing=items[0].termMissing.join('、');
  const coverageKey=item=>[...item.termMissing].sort().join('、');
  const sameCoverage=items.every(item=>coverageKey(item)===coverageKey(items[0]));
  const hasSubtotals=items.every(item=>Number.isFinite(item.knownTermCost));
  const comparable=sameCoverage&&hasSubtotals;
  const hasDifferentTerms=items.every(item=>item.term!==null)&&!sameTerm;
  const termLabel=sameTerm
    ? comparable&&missing?`租期支出（${months(items[0].term)} · 已知小计）`:`租期支出（${months(items[0].term)}）`
    : '租期内支出';
  let termNote='';
  if(comparable&&missing)termNote='未含'+missing;
  if(hasDifferentTerms){
    termNote=[termNote,`租期不同（${items.map(item=>months(item.term)).join(' / ')}），不比较总额`].filter(Boolean).join('。');
    if(!sameCoverage)termNote+='。待确认费用不同，不比较月均支出';
    else if(!hasSubtotals)termNote+='。金额资料不全，不比较月均支出';
  }else if(items.some(item=>item.term===null))termNote='租期待确认，不比较总额';
  else if(!sameCoverage)termNote='待确认费用不同';
  else if(!hasSubtotals)termNote='金额资料待补齐';
  const fields=[
    ['每人月租',item=>item.rentPerPerson,money,true],
    ...(sameTerm?[[termLabel,item=>item.knownTermCost,comparable?money:(_,item)=>termCostText(item),sameTerm&&comparable,termNote,missing?'小计较低':'相对更低']]:[
      ['租期内支出',item=>item.knownTermCost,(_,item)=>termCostText(item),false,termNote],
      ['租期',item=>item.term,months],
      ['每人月均支出',item=>item.term===null||item.knownTermCost===null?null:Math.round(item.knownTermCost/item.term*100)/100,
        comparable?money:(value,item)=>value===null?unknown:item.termTotal===null?`${money(value)}（未含${item.termMissing.join('、')}）`:money(value),comparable,
        comparable&&missing?'未含'+missing:'',missing?'小计较低':'相对更低']]),
    ['入住前须付',item=>item.upfrontCost,money,true],['单程通勤',item=>item.commute,minutes,true],
    ['资料状态',item=>statusText[item.status]]
  ];
  const moreFields=[
    ['原始报价',item=>item.rawRent,money],['报价单位',item=>item.rentUnit],
    ['可退押金',item=>item.refundableDeposit,money],['每人每月水电',utilityText],
    ...(sameTerm?[['每人月均预计支出',item=>item.averageMonthly,money,true]]:[]),
    ['区域',item=>item.district],['房型',item=>item.bedrooms],['待核对事项',verificationText],
    ['来源与备注',item=>`${item.source==='未注明'||!item.source?'来源待确认':item.source}。 ${item.note||'暂无备注'}`]
  ];
  const rows=fields=>fields.map(([label,getValue,format=value=>value||unknown,rank=false,note='',mark='相对更低'])=>{
    const values=items.map(getValue);
    const lowest=rank&&values.every(Number.isFinite)&&new Set(values).size>1?Math.min(...values):null;
    return `<tr role="row"><th scope="row" role="rowheader">${label}${note?`<small class="compare-row-note">${escapeHTML(note)}</small>`:''}</th>${values.map((value,index)=>{
      const isBest=lowest!==null&&value===lowest;
      return `<td role="cell"${isBest?' class="is-best"':''}>${escapeHTML(format(value,items[index]))}${isBest?`<span class="best-mark">${mark}</span>`:''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const headings=items.map(item=>`<th scope="col" role="columnheader">${escapeHTML(item.name)}</th>`).join('');
  const table=(fields,title)=>`<table class="compare-table cols-${items.length}" role="table"><caption class="sr-only">${title}</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader" class="cmp-dim-head">比较项目</th>${headings}</tr></thead><tbody role="rowgroup">${rows(fields)}</tbody></table>`;
  $('#compareTable').innerHTML=table(fields,'主要比较项目');
  $('#compareMoreTable').innerHTML=table(moreFields,'报价与核对事项');
  $('#compareMore').open=false;
  $('#compareTable').scrollLeft=0;
  $('#compareMoreTable').scrollLeft=0;
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
function updateFeePreview(){
  const form=$('#listingForm');
  const unit=form.elements.utilityUnit.value;
  $('#utilityAmountField').hidden=!['person','shared'].includes(unit);
  $('#utilityPeopleField').hidden=unit!=='shared';
  form.elements.utilityAmount.disabled=$('#utilityAmountField').hidden;
  form.elements.utilityPeople.disabled=$('#utilityPeopleField').hidden;
  $('#utilityAmountLabel').textContent=unit==='shared'?'每月水电账单合计（港元）':'每人每月水电（港元）';
  const item=withFees(Object.fromEntries(new FormData(form)));
  const requiresPeople=Boolean(item.rentUnit&&item.rentUnit!=='每床'&&!item.people);
  $('#peopleHint').textContent=requiresPeople?'请填实际分摊人数。':'每床按 1 人。';
  const fields=[['每人月租',money(item.rentPerPerson)],['每人每月水电',utilityText(item)],
    ['入住前须付（每人）',money(item.upfrontCost)],['其中可退押金',money(item.refundableDeposit)],
    ['租期预计总支出（每人）',termCostText(item)],['每人月均预计支出',money(item.averageMonthly)]];
  const alerts=[];
  if(item.conflictingDeposit)alerts.push('押金月数与金额不一致，请核对。');
  if(item.conflictingAdvance)alerts.push('预付租金月数不能超过租期，请核对。');
  const html=fieldList(fields,'preview-fees')+alerts.map(message=>'<p>'+message+'</p>').join('');
  if($('#feePreview').innerHTML!==html)$('#feePreview').innerHTML=html;
}

function applyOCRFields(parsed){
  const form=$('#listingForm');
  const canFillUtility=!form.elements.utilityUnit.value || form.elements.utilityUnit.value===parsed.utilityUnit;
  for(const key of ['name','district','bedrooms','area','source','note',...feeFields]){
    if(key.startsWith('utility')&&!canFillUtility)continue;
    const field=form.elements[key];
    if(parsed[key]&&(!field.value||(key==='source'&&field.value==='未注明')))field.value=parsed[key];
  }
  if(parsed.utilityUnit||parsed.advanceMonths)$('#costOptions').open=true;
  $('#ocrText').textContent=parsed.raw||'';
  $('#ocrTextPanel').hidden=!parsed.raw;
  const found=parsed.found.length?`已识别${parsed.found.join('、')}。`:'未找到明确的房源字段。';
  const missing=parsed.raw&&parsed.missing.length?`请核对并补充${parsed.missing.join('、')}。`:'';
  $('#draftNote').textContent=found+missing+' 保存前请核对识别结果。';
  updateFeePreview();
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
function addImageFiles(files,opener=$('#chooseFileButton')){
  const list=[...files];if(list.length>1)showToast('已选择多张图片，只使用第一张');const image=list.find(file=>file.type.startsWith('image/'));
  if(!image){setUploadStatus('没有找到图片文件，请选择 JPG、PNG 或 WEBP。');showToast('请选择图片格式的房源截图');return;}
  if(image.size>12*1024*1024){setUploadStatus('图片超过 12 MB，请先压缩截图后再上传。');showToast('图片过大，请选择小于 12 MB 的截图');return;}
  discardDraft();
  state.draftImage=URL.createObjectURL(image);
  state.draftFile=image;
  $('#draftPreview').hidden=false;
  $('#draftPreview').innerHTML=`<img src="${escapeHTML(state.draftImage)}" alt="待识别的本地房源截图">`;
  $('#draftNote').textContent=`已载入 ${image.name}。OCR 会填入空白字段。`;
  openModal($('#uploadModal'),opener);const run=state.ocrRun;recognizeImage(image,run);
}
function discardDraft(){
  state.ocrRun++;
  if(state.draftImage)URL.revokeObjectURL(state.draftImage);
  state.draftImage='';
  state.draftFile=null;
  $('#draftPreview').hidden=true;
  $('#draftPreview').textContent='';
  $('#ocrProgress').hidden=true;
  $('#ocrRetryButton').hidden=true;
  $('#ocrTextPanel').hidden=true;
  $('#ocrTextPanel').open=false;
  $('#ocrText').textContent='';
  $('#draftNote').textContent='';
  state.editingId=null;
  $('#saveListingButton').textContent='加入看板';
  $('#uploadModalTitle').textContent='确认房源资料';
  $('#listingForm').reset();
  $$('details',$('#listingForm')).forEach(details=>{details.open=false;});
  updateFeePreview();
}
function resetFilters(){ $('#searchInput').value='';$('#districtFilter').value='all';$('#rentFilter').value='all';$('#sortSelect').value='status';state.showSaved=false;render(); }
function handleListingAction(event){const button=event.target.closest('[data-action="detail"],[data-action="save"]');if(!button)return;const {action,id}=button.dataset;if(action==='detail')openDetail(id,button);if(action==='save'){if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);persistLocalData();render();showToast(state.saved.has(id)?'已加入收藏':'已取消收藏');}}
function handleCompareChange(event){const input=event.target.closest('input[data-action="compare"]');if(!input)return;const id=input.dataset.id;if(input.checked&&state.compared.size>=3){input.checked=false;showToast('最多同时比较 3 套房源');return;}if(input.checked)state.compared.add(id);else state.compared.delete(id);render();}
function editListing(item,opener){
  discardDraft();
  state.editingId=item.id;
  const form=$('#listingForm');
  for(const field of form.elements){
    if(!field.name||item[field.name]==null)continue;
    if(field.type==='checkbox')field.checked=item[field.name]===field.value;
    else field.value=item[field.name];
  }
  $('#uploadModalTitle').textContent='编辑房源资料';
  $('#saveListingButton').textContent='保存修改';
  $('#costOptions').open=true;
  updateFeePreview();
  openModal($('#uploadModal'),opener);
}

function saveListing(event){
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.currentTarget));
  data.utilityAmount??='';
  data.utilityPeople??='';
  data.otherCostsPending??='';
  const name=data.name.trim();
  if(!name){event.currentTarget.elements.name.focus();return;}
  const editingIndex=listings.findIndex(item=>item.id===state.editingId);
  const previous=editingIndex<0?null:listings[editingIndex];
  const item=withFees({...previous,...data,id:previous?.id??`user-${Date.now()}`,name,note:data.note.trim(),
    bedrooms:data.bedrooms.trim(),area:data.area.trim(),updated:new Date().toLocaleDateString('sv-SE'),image:previous?.image??state.draftImage});
  if(previous)listings[editingIndex]=item;
  else listings.unshift(item);
  persistLocalData();
  // The listing owns the preview URL until this page is refreshed.
  state.draftImage='';
  closeModal($('#uploadModal'));
  if(previous)closeModal($('#detailModal'));
  resetFilters();
  setPage('workspace',true);
  $('#boardTitle').focus({preventScroll:true});
  $('#board').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  showToast(previous?'房源资料已更新':'房源已加入当前看板');
}
function bind(){
  document.addEventListener('click',event=>{const link=event.target.closest('[data-page-link],a[href="#workspace"],a[href="#guide"]');if(!link)return;const page=link.getAttribute('href')==='#guide'?'guide':'workspace';event.preventDefault();setPage(page,true);window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  window.addEventListener('hashchange',syncPageFromHash);window.addEventListener('popstate',syncPageFromHash);
  ['searchInput','districtFilter','rentFilter','sortSelect'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',render));
  $('#clearFilters').addEventListener('click',resetFilters);$('#savedFilter').addEventListener('click',()=>{state.showSaved=!state.showSaved;render();setPage('workspace',true);$('#board').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  $$('.view-toggle').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.view;render();}));$('#listingRows').addEventListener('click',handleListingAction);$('#cardView').addEventListener('click',handleListingAction);$('#listingRows').addEventListener('change',handleCompareChange);$('#cardView').addEventListener('change',handleCompareChange);
  const fileInput=$('#fileInput');
  let pickerOpener;
  $$('[data-file-picker]').forEach(button=>button.addEventListener('click',()=>{
    pickerOpener=button;
    fileInput.click();
  }));
  fileInput.addEventListener('change',()=>{
    if(fileInput.files.length)addImageFiles(fileInput.files,pickerOpener);
    fileInput.value='';
    pickerOpener=undefined;
  });
  $('#manualEntryButton').addEventListener('click',event=>{
    discardDraft();
    openModal($('#uploadModal'),event.currentTarget);
    $('#listingForm').elements.name.focus();
  });
  $('#ocrRetryButton').addEventListener('click',()=>{if(!state.draftFile)return;state.ocrRun++;$('#ocrRetryButton').hidden=true;recognizeImage(state.draftFile,state.ocrRun);});
  const drop=$('#dropZone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('is-over');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('is-over');}));drop.addEventListener('drop',event=>addImageFiles(event.dataTransfer.files));
  document.addEventListener('paste',event=>{const image=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'));if(image){const file=image.getAsFile();if(file)addImageFiles([file]);}});
  $('#pasteButton').addEventListener('click',async()=>{try{if(!navigator.clipboard?.read)throw new Error('paste');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(type){addImageFiles([await item.getType(type)]);return;}}setUploadStatus('剪贴板里没有图片，也可以按 Ctrl / ⌘ + V 粘贴截图。');showToast('剪贴板里没有图片');}catch{setUploadStatus('请先复制截图，再按 Ctrl / ⌘ + V 粘贴。');showToast('请先复制截图，再粘贴');}});
  $('#listingForm').addEventListener('input',event=>{
    if(event.target.name==='utilityUnit'){
      event.currentTarget.elements.utilityAmount.value='';
      event.currentTarget.elements.utilityPeople.value='';
    }
    if(feeFields.includes(event.target.name))updateFeePreview();
  });
  $('#listingForm').addEventListener('invalid',event=>{
    for(const details of $('#listingForm details')){
      if(details.contains(event.target))details.open=true;
    }
  },true);
  $('#listingForm').addEventListener('submit',saveListing);
  $('#compareButton').addEventListener('click',event=>openCompare(event.currentTarget));$('#clearCompare').addEventListener('click',()=>{state.compared.clear();render();$('.view-toggle.is-active').focus();});$('#methodButton').addEventListener('click',event=>openModal($('#methodModal'),event.currentTarget));
  document.addEventListener('click',event=>{const button=event.target.closest('[data-empty-action]');if(!button)return;const action=button.dataset.emptyAction;if(action==='search'){$('#searchInput').value='';render();$('#searchInput').focus();}else if(action==='saved'){state.showSaved=false;render();}else if(action==='all'||action==='filters'){resetFilters();}});
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal($('#'+button.dataset.close))));
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('click',event=>{if(event.target===dialog)closeModal(dialog);});
    dialog.addEventListener('close',()=>{
      if(dialog.open)return;
      if(dialog.id==='uploadModal')discardDraft();
      if(document.activeElement===$('#boardTitle'))return;
      const opener=dialogOpeners.get(dialog);
      if(opener?.isConnected)opener.focus({preventScroll:true});
    });
  });
}

bind();render();syncPageFromHash();
