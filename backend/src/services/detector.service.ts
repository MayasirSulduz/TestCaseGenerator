import {
  AVAILABLE_FRAMEWORKS_MAP,
  FRAMEWORK_MAP,
  LANGUAGE_MAP
} from '../config/constants';
import { DetectFrameworkResponseDTO } from '../types';

export function detectFramework(filename: string): DetectFrameworkResponseDTO {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

  const detectedLanguage = LANGUAGE_MAP[ext] || 'JavaScript';
  const detectedFramework = FRAMEWORK_MAP[ext] || 'Jest';
  const availableFrameworks =
    AVAILABLE_FRAMEWORKS_MAP[detectedLanguage] || [detectedFramework];

  return {
    status: 'success',
    framework: detectedFramework,
    language: detectedLanguage,
    extension: ext,
    availableFrameworks
  };
}
