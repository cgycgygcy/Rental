(function(root){
  'use strict';

  const traditional='寶鑽灣將軍調嶺貢區門東離島觀黃龍藍頭盤號樓層廳間單實積呎幣約個兩車鐘學轉聯絡電話傢儲萬鄰業產臥攤報價額費傭無確認備註須項權經紀總數體齊視';
  const simplified='宝钻湾将军调岭贡区门东离岛观黄龙蓝头盘号楼层厅间单实积尺币约个两车钟学转联络电话家储万邻业产卧摊报价额费佣无确认备注须项权经纪总数体齐视';
  function normalize(text){
    return String(text).normalize('NFKC').replace(new RegExp('['+traditional+']','g'),char=>simplified[traditional.indexOf(char)]);
  }

  const amount='(?:HK\\$|HKD\\$?|港币|港元|\\$)?([\\d,]+(?:\\.\\d+)?)(万|k)?(?:港元|元)?';
  const unit='(?:每床(?:位)?|每房(?:间)?|整套|全套|全屋|每人|人均|床位|床|房间|房|人|套)';
  const quoteUnit=value=>{
    if(!value)return '';
    if(/套|全屋/.test(value))return '整套';
    if(/房/.test(value))return '每房';
    return '每床';
  };
  const unitSuffix=new RegExp('^(?:/|／|\\(|每月/?)('+unit+')','i');
  const unitPrefix=new RegExp('('+unit+')$','i');
  const numberWord='\\d{1,2}|[一二三四五六七八九十两]{1,3}';
  function quantity(value){
    if(/^\d+$/.test(value))return Number(value);
    const digit=word=>'一二三四五六七八九'.indexOf(word.replace('两','二'))+1;
    if(value.includes('十')){
      const [tens,ones]=value.split('十');
      return (tens?digit(tens):1)*10+(ones?digit(ones):0);
    }
    return digit(value);
  }
  function moneyValue(match){
    return Number(match[1].replace(/,/g,''))*(match[2]==='万'?10000:/k/i.test(match[2]||'')?1000:1);
  }

  const feeLabel='(?:押金(?:金额|月数)?|按金(?:金额|月数)?|deposit|中介费|经纪费|代理费|佣金|agencyfee|agentfee|commission)';
  const rentLabel='(?:月租|租金|租价|monthlyrent|rent)';
  const labelledRent=new RegExp(rentLabel+'(?:\\(('+unit+')\\))?(?:为|是|:|=)?\\s*'+amount,'i');
  const perUnitRent=new RegExp('('+unit+')(?:月租|租金|报价)?(?:为|是|:|=)?'+amount,'i');
  const currencyRent=new RegExp('(?=(?:HK\\$|HKD\\$?|港币|港元|\\$))'+amount,'i');
  const amountWithUnit=new RegExp(amount+'(?=(?:/|每月/?)'+unit+')','i');

  function readQuote(fragments){
    for(const [pattern,firstUnitGroup] of [[labelledRent,true],[perUnitRent,true],[amountWithUnit,false],[currencyRent,false]]){
      for(const fragment of fragments){
        // Read the rent before an inline fee label, and ignore fee-only lines.
        const rentPart=fragment.split(new RegExp(feeLabel,'i'))[0];
        const match=rentPart.match(pattern);
        if(!match)continue;
        const value=moneyValue(firstUnitGroup?match.slice(1):match);
        if(value<1000||value>100000)continue;
        const before=rentPart.slice(0,match.index);
        const after=rentPart.slice(match.index+match[0].length).replace(/^\/月/,'');
        const units=[firstUnitGroup?match[1]:'',before.match(unitPrefix)?.[1],after.match(unitSuffix)?.[1]].map(quoteUnit).filter(Boolean);
        return {rawRent:String(value),rentUnit:new Set(units).size===1?units[0]:''};
      }
    }
    return {rawRent:'',rentUnit:''};
  }

  function readFeeAmount(fragments,label,rentUnit){
    const feePattern=new RegExp(label+'(?:为|是|:|=)?'+amount+'(?![\\d,.]|个?月|\\d*成|%)','i');
    for(const fragment of fragments){
      const match=fragment.match(feePattern);
      if(!match)continue;
      const after=fragment.slice(match.index+match[0].length);
      const feeUnit=quoteUnit(after.match(unitSuffix)?.[1]);
      const value=moneyValue(match);
      if(Number.isFinite(value)&&(!feeUnit||feeUnit===rentUnit||value===0))return String(value);
    }
    return '';
  }

  function parse(text,areas){
    const originalLines=String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const lines=originalLines.map(line=>normalize(line).replace(/\s+/g,''));
    const all=lines.join('\n');
    const fragments=lines.flatMap(line=>line.split(/(?<!\d),|,(?!\d)|[;；。|]/));

    const priceFragments=fragments.filter(line=>!/(?:售价|售盘|按揭|编号|楼盘号|物业号|管理费|水电费)/i.test(line));
    const quote=readQuote(priceFragments);
    const standaloneUnit=all.match(new RegExp('(?:^|\\n)(?:报价单位|租金单位)[:=]?('+unit+')(?=\\n|$)','i'));
    if(quote.rawRent&&standaloneUnit)quote.rentUnit=quote.rentUnit||quoteUnit(standaloneUnit[1]);
    const result={...quote,name:'',district:'',people:'',commute:'',term:'',depositMonths:'',depositAmount:'',
      intermediaryFee:'',verificationItems:'',bedrooms:'',area:'',source:'',note:'',found:[],missing:[]};

    const specific=['大埔仔','清水湾','西贡','坑口','将军澳','调景岭','宝琳','康城','彩虹','钻石山','牛池湾','九龙湾','蓝田','油塘'];
    const regionAliases={'中西':'中西区','湾仔':'湾仔区','油尖旺':'油尖旺区','深水埗':'深水埗区','九龙城':'九龙城区','黄大仙':'黄大仙区','观塘':'观塘区','葵青':'葵青区','荃湾':'荃湾区','屯门':'屯门区','元朗':'元朗区','大埔':'大埔区','沙田':'沙田区','离岛':'离岛区'};
    result.district=specific.find(area=>all.includes(area))||(areas||[]).filter(area=>area.endsWith('区')).find(area=>all.includes(area))||Object.entries(regionAliases).find(([alias])=>all.includes(alias))?.[1]||'';

    const titleIndex=lines.findIndex(line=>line.length<=90&&!/(?:编号|物业号|联络|电话|微信)/.test(line)&&/(?:村屋|屋苑|唐楼|合租|宿舍|单间|公寓|花园|海岸|豪庭|中心|大厦|租盘|出租)/.test(line));
    if(titleIndex>=0)result.name=originalLines[titleIndex].replace(/\s+/g,' ').replace(/\[代理[盤盘]\]/g,'').trim().slice(0,70);
    const room=all.match(/([一二三四五六七八九两\d]+)(?:房|卧)(?:[一二三四五六七八九两\d]*厅)?(?:[,、]?[一二三四五六七八九两\d]+(?:浴室?|厕|卫))?/);
    if(room)result.bedrooms=room[0];
    const area=all.match(/(?:实用(?:面积)?[:：]?)?([\d,]{2,5}(?:\.\d+)?)(平方英尺|平方公尺|平方尺|平方米|sq\.?ft|ft²|㎡|m²)/i);
    if(area)result.area=area[1]+' '+(/^(?:平方英尺|平方尺|sq\.?ft|ft²)$/i.test(area[2])?'平方呎':'平方米');

    const commute=lines.filter(line=>/(?:科大|HKUST|到校|通勤)/i.test(line)).join('\n')
      .match(/(?:通勤|车程|步行|到校|科大|HKUST)[^\d\n]{0,12}(\d{1,3})(?:分钟|分|min)|(?:(\d{1,3})(?:分钟|分|min)[^\n]{0,10}(?:到校|科大|HKUST))/i);
    if(commute&&Number(commute[1]||commute[2])<240)result.commute=String(Number(commute[1]||commute[2]));
    const term=all.match(new RegExp('(?:租期|租约|lease)(?:约|为|是|:|=)?('+numberWord+')(个月|月|年|months?)','i'));
    if(term){
      const months=quantity(term[1])*(term[2]==='年'?12:1);
      if(months>0&&months<=60)result.term=String(months);
    }
    const shared=all.match(new RegExp('(?:分摊人数|分摊|合租人数|每房住|每房|整套共)[:=]?('+numberWord+')人|('+numberWord+')人(?:共同)?(?:分摊|合租)','i'));
    if(shared){
      const people=quantity(shared[1]||shared[2]);
      if(people>0)result.people=String(people);
    }

    const deposit=all.match(/(?:押金(?:月数)?|按金(?:月数)?|deposit)(?:为|是|:|=)?(\d+(?:\.\d+)?)(?:个月|月|months?)/i)
      ||all.match(new RegExp('押('+numberWord+')付(?:'+numberWord+')'));
    if(deposit){
      const months=/^[\d.]+$/.test(deposit[1])?Number(deposit[1]):quantity(deposit[1]);
      if(months>=0&&months<=12)result.depositMonths=String(months);
    }
    result.depositAmount=readFeeAmount(fragments,'(?:押金(?:金额)?|按金(?:金额)?|deposit)',result.rentUnit);
    if(!result.depositAmount&&/(?:免押金|免按金|无押金|无按金|押金(?:为|是|:)?全免)/.test(all))result.depositAmount='0';
    result.intermediaryFee=readFeeAmount(fragments,'(?:中介费|经纪费|代理费|佣金|agencyfee|agentfee|commission)',result.rentUnit);
    if(!result.intermediaryFee&&/(?:免(?:中介费|佣金|代理费|经纪费)|无(?:中介费|佣金|代理费|经纪费)|免佣(?:$|[\n#，,。!])|(?:中介费|佣金|代理费|经纪费)(?:为|是|:)?全免)/.test(all))result.intermediaryFee='0';

    const checks=originalLines.filter((_,index)=>/(?:待核对|需核对|待确认|需确认|待核实|需核实|尚未确认)/.test(lines[index]));
    result.verificationItems=checks.map(line=>line.replace(/^(?:待[核覈][對对]事項|待[核覈][對对]事项|待確認事項|待确认事项)\s*[:：]\s*/,'')).join('、').slice(0,300);

    if(/代理盘|代理提供|中介|地产/.test(all))result.source='中介';
    else if(/小红书|小紅書/.test(all))result.source='小红书';

    const labels={rawRent:'原始报价',rentUnit:'报价单位',people:'分摊人数',term:'租期',depositMonths:'押金月数',
      depositAmount:'押金金额',intermediaryFee:'中介费',commute:'单程通勤',verificationItems:'待核对事项',
      district:'区域',name:'房源名称',bedrooms:'房型',area:'面积',source:'来源'};
    result.found=Object.entries(labels).filter(([key])=>result[key]).map(([,label])=>label);
    const required=['rawRent','rentUnit','commute','term','intermediaryFee'];
    if(result.rentUnit==='整套'||result.rentUnit==='每房')required.push('people');
    result.missing=required.filter(key=>!result[key]).map(key=>key==='rawRent'?'月租':labels[key]);
    if(!result.depositMonths&&!result.depositAmount)result.missing.push('押金');

    // Preserve the original parser properties for callers that display recognized text.
    return {...result,rent:result.rawRent,deposit:result.depositMonths};
  }

  const api={parse,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RentalOCR=api;
})(typeof window!=='undefined'?window:globalThis);
