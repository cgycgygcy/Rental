(function(root){
  'use strict';

  const fields = [
    'rawRent', 'rentUnit', 'people', 'term', 'depositMonths', 'depositAmount', 'intermediaryFee',
    'utilityUnit', 'utilityAmount', 'utilityPeople', 'otherMonthly', 'otherUpfront', 'advanceMonths', 'otherCostsPending'
  ];

  function numeric(value, min=0){
    if(typeof value!=='number' && (typeof value!=='string' || !value.trim())) return null;
    const parsed=Number(value);
    return Number.isFinite(parsed) && parsed>=min ? parsed : null;
  }

  function peopleCount(value){
    const count=numeric(value,1);
    return Number.isSafeInteger(count) ? count : null;
  }

  const roundMoney=value=>Math.round((value+Number.EPSILON)*100)/100;
  function split(amount, count){
    if(amount===0) return 0;
    return amount!==null && count!==null ? amount/count : null;
  }

  function withFees(item){
    const rawRent=numeric(item.rawRent);
    const rentUnit=['每床','每房','整套'].includes(item.rentUnit) ? item.rentUnit : '';
    const people=peopleCount(item.people);
    const shares=rentUnit==='每床' ? 1 : rentUnit ? people : null;
    const rent=rawRent!==null && shares!==null ? rawRent/shares : null;
    const term=numeric(item.term,.01);
    const commuteMinutes=numeric(item.commute);
    const commute=Number.isSafeInteger(commuteMinutes) ? commuteMinutes : null;

    const depositMonths=numeric(item.depositMonths);
    const depositAmount=numeric(item.depositAmount);
    const depositFromMonths=depositMonths===0 ? 0 : depositMonths!==null && rawRent!==null ? depositMonths*rawRent : null;
    const conflictingDeposit=depositAmount!==null && depositFromMonths!==null &&
      roundMoney(depositAmount)!==roundMoney(depositFromMonths);
    const totalDeposit=conflictingDeposit ? null : depositAmount??depositFromMonths;
    const refundableDeposit=split(totalDeposit,shares);
    const intermediaryFee=numeric(item.intermediaryFee);
    const feeShare=split(intermediaryFee,shares);

    const utilityUnit=['included','person','shared'].includes(item.utilityUnit) ? item.utilityUnit : '';
    const utilityAmount=utilityUnit==='included' ? null : numeric(item.utilityAmount);
    const utilityPeople=utilityUnit==='shared' ? peopleCount(item.utilityPeople) : null;
    const utilityShare=utilityUnit==='included' ? 0 : utilityUnit==='person' ? utilityAmount :
      utilityUnit==='shared' ? split(utilityAmount,utilityPeople) : null;

    // Other costs are optional additions, entered by the user on a per-person basis.
    const otherMonthly=numeric(item.otherMonthly);
    const otherUpfront=numeric(item.otherUpfront);
    const otherCostsPending=item.otherCostsPending==='yes' ? 'yes' : '';
    const advanceMonths=numeric(item.advanceMonths,.01);
    // Existing records used one month of rent for the move-in calculation.
    const prepaidMonths=advanceMonths ?? Math.min(1,term??1);
    const conflictingAdvance=term!==null && prepaidMonths>term;
    const prepaidRent=rent!==null && !conflictingAdvance ? rent*prepaidMonths : null;
    const upfrontCost=[prepaidRent,refundableDeposit,feeShare].every(Number.isFinite)
      ? roundMoney(prepaidRent+refundableDeposit+feeShare+(otherUpfront??0)) : null;

    const termMissing=[];
    if(rent===null) termMissing.push('人均月租');
    if(term===null) termMissing.push('租期');
    if(utilityShare===null) termMissing.push('水电费');
    if(feeShare===null) termMissing.push('中介费');
    if(otherCostsPending) termMissing.push('其他费用');

    const knownTermCost=rent!==null && term!==null
      ? roundMoney((rent+(utilityShare??0)+(otherMonthly??0))*term+(feeShare??0)+(otherUpfront??0)) : null;
    const termTotal=termMissing.length===0 ? knownTermCost : null;
    const averageMonthly=termTotal===null ? null : roundMoney(termTotal/term);
    return {
      ...item,rawRent,rentUnit,people,term,commute,depositMonths,depositAmount,intermediaryFee,
      utilityUnit,utilityAmount,utilityPeople,otherMonthly,otherUpfront,otherCostsPending,advanceMonths,prepaidMonths,
      utilityShare:utilityShare===null ? null : roundMoney(utilityShare),
      rentPerPerson:rent===null ? null : roundMoney(rent),
      prepaidRent:prepaidRent===null ? null : roundMoney(prepaidRent),
      feeShare:feeShare===null ? null : roundMoney(feeShare),
      refundableDeposit:refundableDeposit===null ? null : roundMoney(refundableDeposit),
      upfrontCost,knownTermCost,termTotal,averageMonthly,termMissing,totalDeposit,conflictingDeposit,conflictingAdvance,
      verificationItems:String(item.verificationItems??'').trim()
    };
  }

  const api={fields,withFees};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.RentalFees=api;
})(typeof window!=='undefined' ? window : globalThis);
