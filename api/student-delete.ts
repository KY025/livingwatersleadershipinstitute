import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

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

type DeleteStudentRequest = {
  studentId?: string;
  authUserId?: string;
  permanent?: boolean;
};

const translateDatabaseError = (error: { code?: string; message?: string }): string => {
  const codeMap: Record<string, string> = {
    '23503': '无法删除：该学房生仍包含相关记录，请先清理相关数据',
    '42501': '权限不足：无法执行删除操作',
  };
  if (error.code && codeMap[error.code]) return codeMap[error.code];
  const msg = error.message?.toLowerCase() || '';
  if (msg.includes('foreign key constraint')) {
    return '无法删除：该学房生在其他表中有相关记录';
  }
  return '数据库操作失败，请稍后再试';
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时`)), ms),
    ),
  ]);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: '仅支持 POST 请求' });
  }

  const body = (request.body || {}) as DeleteStudentRequest;
  const { studentId, authUserId, permanent = false } = body;

  if (!studentId) {
    return response.status(400).json({ error: '缺少学房生ID' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(500).json({ error: '系统配置缺失，请联系系统管理员' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (!permanent) {
      const { error } = await admin
        .from('students')
        .update({ status: 'inactive' })
        .eq('id', studentId);
      if (error) throw new Error(translateDatabaseError(error));
      return response.status(200).json({
        ok: true,
        action: 'deactivated',
        message: '已成功停用该学房生账号',
      });
    }

    const { data: student, error: studentLookupError } = await admin
      .from('students')
      .select('id, student_name, email, auth_user_id, drive_folder_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentLookupError) throw new Error(translateDatabaseError(studentLookupError));
    if (!student) return response.status(404).json({ error: '找不到该学房生' });

    const actualAuthUserId = authUserId || student.auth_user_id;

    let driveWarning: string | null = null;
    
    let folderIdToDelete = student.drive_folder_id;

    try {
      const drive = getDrive();

      if (!folderIdToDelete && student.student_name) {
        const rootFolderId = process.env.DRIVE_HOMEWORK_FOLDER_ID;
        if (rootFolderId) {
          const sName = student.student_name ? student.student_name.trim() : '';
          const sEmail = student.email ? student.email.trim() : '';
          const folderName = sEmail ? `${sName} (${sEmail})` : sName;
          
          const q = `'${rootFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
          const listRes = await drive.files.list({
            q,
            fields: 'files(id)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          if (listRes.data.files && listRes.data.files.length > 0) {
            folderIdToDelete = listRes.data.files[0].id;
          }
        }
      }

      if (folderIdToDelete) {
        await withTimeout(
          drive.files.delete({
            fileId: folderIdToDelete,
            supportsAllDrives: true,
          }) as unknown as Promise<unknown>,
          8000, 
          '学房生文件夹删除',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const isNotFound = message.includes('404') || message.includes('not found');
      if (!isNotFound) {
        console.error('Drive 清理失败:', folderIdToDelete, error);
        driveWarning = '云端文件夹清理未完成，请手动前往网盘检查';
      }
    }

    const [profileResult, authResult] = await Promise.all([
      admin.from('students').delete().eq('id', studentId),
      actualAuthUserId
        ? admin.auth.admin.deleteUser(actualAuthUserId)
        : Promise.resolve({ error: null as null | { message: string } }),
    ]);

    if (profileResult.error) throw new Error(translateDatabaseError(profileResult.error));

    if (authResult.error && !authResult.error.message.includes('User not found')) {
      console.error('Auth 删除失败:', authResult.error.message);
      return response.status(200).json({
        ok: true,
        action: 'permanently_deleted',
        message: '学房生记录已删除，但登录账号删除失败，请手动检查',
      });
    }

    return response.status(200).json({
      ok: true,
      action: 'permanently_deleted',
      message: driveWarning
        ? `学房生已删除（${driveWarning}）`
        : '学房生账号及相关网盘记录已永久删除',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败，请稍后再试';
    return response.status(500).json({ error: message });
  }
}
