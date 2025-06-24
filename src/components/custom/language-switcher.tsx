import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import { Globe } from 'lucide-react'; // Icon for language

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Get current language to highlight the active button or for other logic
  const currentLanguage = i18n.language;

  return (
    <div className="flex items-center space-x-1">
      <Button
        variant={currentLanguage.startsWith('en') ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => changeLanguage('en')}
                aria-label={t('languageSwitcher.switchToEnglish')}
      >
        EN
      </Button>
      <Button
        variant={currentLanguage.startsWith('zh') ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => changeLanguage('zh')}
                aria-label={t('languageSwitcher.switchToChinese')}
      >
        中文
      </Button>
    </div>
  );
}
