export interface DriveFile {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

export interface DriveUploadResult {
  files: DriveFile[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 上传作业文件到 Google Drive 并同步至数据库
 * @param files 
 * @param studentId 
 * @param studentName
 * @param studentEmail
 * @param seriesId
 */
export async function uploadHomework(
  files: File[],
  studentId: string,
  studentName: string,
  studentEmail: string,
  seriesId?: string,
): Promise<DriveUploadResult> {
  const MAX_SIZE = 3 * 1024 * 1024; 
  const uploaded: DriveFile[] = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      throw new Error(`文件超过 3MB，提交失败！`);
    }

    const base64Data = await fileToBase64(file);

    const res = await fetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload',
        studentId,
        studentName,
        studentEmail,
        seriesId, 
        fileName: file.name,
        fileType: file.type,
        fileData: base64Data,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`文件上传失败: ${errText}`);
    }

    const data = await res.json();
    uploaded.push({
      fileId: data.fileId,
      fileName: data.fileName,
      webViewLink: data.webViewLink,
    });
  }

  return { files: uploaded };
}

/**
 * 删除已上传的作业文件
 * @param fileId 
 * @param studentId
 * @param seriesId 
 */
export async function deleteHomework(
  fileId: string,
  studentId?: string,
  seriesId?: string
): Promise<void> {
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      fileId,
      studentId,
      seriesId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`删除失败: ${text}`);
  }
}