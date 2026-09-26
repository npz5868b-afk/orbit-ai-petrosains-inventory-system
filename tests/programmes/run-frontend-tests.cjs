const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const tsc=process.env.ORBIT_TYPESCRIPT_PATH??require.resolve('typescript/lib/tsc.js',{paths:[root]});
for(const args of [[tsc,'--version'],[tsc,'-p','tests/programmes/tsconfig.core.json'],[tsc,'-p','tests/programmes/tsconfig.api.json'],['--test','tests/programmes/core.test.cjs','tests/programmes/resources.test.cjs','tests/programmes/api.test.cjs','tests/programmes/frontend.test.cjs']]){
 const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);
}
