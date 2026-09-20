export type PhotoDoc = { id:string; homeId:string; kind:"photo"; itemId:string; data:string };

export function photoId(itemId:string):string { return "photo-"+itemId; }

// Separate documents keep image data out of inventory responses and the home
// document size limit. The API checks home membership before reading a photo.
export function photoDocument(homeId:string,itemId:string,data:unknown):PhotoDoc {
 if(typeof data!=="string"||!data.startsWith("data:image/webp;base64,"))throw new Error("A WebP image is required.");
 const bytes=Buffer.from(data.slice(23),"base64");
 if(bytes.length>650000||bytes.length<12||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")throw new Error("Invalid or oversized WebP. Choose a smaller photo.");
 return {id:photoId(itemId),homeId,kind:"photo",itemId,data:"data:image/webp;base64,"+bytes.toString("base64")};
}
