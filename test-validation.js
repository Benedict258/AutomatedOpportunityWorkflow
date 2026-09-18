function isValidTimestamp(ts){ const d=new Date(ts); return !isNaN(d.getTime());}
function validateDeadline(deadline, deadlineType){
  if(!deadlineType) return {valid:false, reason:'deadlineType required'};
  if(deadlineType==='FIXED'){
    if(!deadline) return {valid:false, reason:'FIXED deadline requires a value'};
    if(!isValidTimestamp(deadline)) return {valid:false, reason:'invalid deadline timestamp'};
    return {valid:true};
  }
  if(deadlineType==='ROLLING'){
    if(deadline) return {valid:false, reason:'ROLLING deadline should not have a date'};
    return {valid:true};
  }
  if(deadlineType==='UNKNOWN') return {valid:true};
  return {valid:false, reason:'unknown deadline type'};
}

console.log('Test FIXED valid', validateDeadline('2025-12-31','FIXED'));
console.log('Test FIXED missing', validateDeadline(null,'FIXED'));
console.log('Test ROLLING valid', validateDeadline(null,'ROLLING'));
console.log('Test ROLLING with date', validateDeadline('2025-12-31','ROLLING'));
console.log('Test UNKNOWN', validateDeadline(null,'UNKNOWN'));

console.log('All validation tests executed');
