/**
 * 这个文件是用来封装全局统一请求的
 * 外部使用示例
 * http.get("/admin/user/login",{id:1},{isCancel:false,timeout:50000,onUploadProgress:()=>{},onDownloadProgress:()=>{}}).then()
 * http.post("/admin/user/login",{id:1},{isCancel:false,timeout:50000,onUploadProgress:()=>{},onDownloadProgress:()=>{}}).then()
 *
 * */

const base_url = import.meta.env.VITE_API_BASE;
