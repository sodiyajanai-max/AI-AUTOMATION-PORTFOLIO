(function(){
  var r=document.documentElement,t;
  try{t=localStorage.getItem('theme')}catch(e){}
  if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  r.setAttribute('data-theme',t);
  document.addEventListener('DOMContentLoaded',function(){
    var b=document.getElementById('theme');
    if(!b)return;
    b.addEventListener('click',function(){
      t=r.getAttribute('data-theme')==='dark'?'light':'dark';
      r.setAttribute('data-theme',t);
      try{localStorage.setItem('theme',t)}catch(e){}
    });
  });
})();
