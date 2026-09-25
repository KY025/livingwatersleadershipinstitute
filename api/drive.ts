import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('系统缺少 Supabase 配置环境变量');
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getDrive() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('系统缺少 Google OAuth2 配置环境变量');
  }
  
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

function base64ToStream(base64Data: string): Readable {
  const pureBase64 = base64Data.replace(/^data:(.*);base64,/, '');
  const buffer = Buffer.from(pureBase64, 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function getOrCreateStudentFolder(drive: any, rootFolderId: string, folderName: string): Promise<string> {
  const safeName = folderName.replace(/'/g, "\\'");
  const query = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;

  const searchRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0].id;
  }

  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [rootFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });

  return folder.data.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { action, studentId, studentName, studentEmail, seriesId, fileName, fileType, fileData, fileId } = req.body || {};

    const supabase = getSupabase();
    const drive = getDrive();

    if (action === 'upload') {
      if (!fileData || !fileName || !studentId) {
        return res.status(400).json({ error: '缺少 studentId, fileName, fileData' });
      }

      const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

      let targetFolderId = rootFolderId;

      if (rootFolderId) {
        const sName = studentName ? studentName.trim() : `Student_${studentId}`;
        const sEmail = studentEmail ? studentEmail.trim() : '';
        const folderName = sEmail ? `${sName} (${sEmail})` : sName;
        
        targetFolderId = await getOrCreateStudentFolder(drive, rootFolderId, folderName);

        await supabase
          .from('students')
          .update({ drive_folder_id: targetFolderId })
          .eq('id', studentId);
      }

      const mediaStream = base64ToStream(fileData);

      const driveRes = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: targetFolderId ? [targetFolderId] : undefined,
        },
        media: {
          mimeType: fileType || 'application/octet-stream',
          body: mediaStream,
        },
        fields: 'id, name, webViewLink',
      });

      const uploadedFileId = driveRes.data.id;
      const webViewLink = driveRes.data.webViewLink || '';

      if (!uploadedFileId) {
        return res.status(500).json({ error: '上传失败，未获取到 fileId' });
      }

      await drive.permissions.create({
        fileId: uploadedFileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      if (seriesId) {
        const { data: existingRecord } = await supabase
          .from('series_task_records')
          .select('drive_files')
          .eq('student_id', studentId)
          .eq('series_id', seriesId)
          .maybeSingle();

        const currentFiles = existingRecord?.drive_files || [];
        const newFileItem = {
          fileId: uploadedFileId,
          fileName: fileName,
          webViewLink: webViewLink,
          uploadedAt: new Date().toISOString(),
        };
        const updatedFiles = [...currentFiles, newFileItem];

        await supabase
          .from('series_task_records')
          .upsert(
            {
              student_id: studentId,
              series_id: seriesId,
              student_done: true,
              teacher_confirmed: false,
              remarks: null,
              drive_files: updatedFiles, 
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,series_id' }
          );
      }

      return res.status(200).json({
        fileId: uploadedFileId,
        fileName: driveRes.data.name || fileName,
        webViewLink: webViewLink,
      });
    }

    if (action === 'delete') {
      if (!fileId) {
        return res.status(400).json({ error: '缺少 fileId' });
      }

      await drive.files.delete({ fileId });

      if (studentId && seriesId) {
        const { data: existingRecord } = await supabase
          .from('series_task_records')
          .select('id, drive_files')
          .eq('student_id', studentId)
          .eq('series_id', seriesId)
          .maybeSingle();

        if (existingRecord?.drive_files) {
          const updatedFiles = existingRecord.drive_files.filter(
            (item: any) => item.fileId !== fileId
          );

          if (updatedFiles.length === 0) {
            await supabase
              .from('series_task_records')
              .delete()
              .eq('id', existingRecord.id);
          } else {
            await supabase
              .from('series_task_records')
              .update({
                drive_files: updatedFiles,
                student_done: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingRecord.id);
          }
        }
      }

      return res.status(200).json({ success: true, message: '文件删除成功' });
    }

    return res.status(400).json({ error: '仅支持上传或删除' });
  } catch (error: any) {
    console.error('Vercel API 处理出错:', error);
    return res.status(500).json({ error: error.message || '服务器内部错误' });
  }
}
