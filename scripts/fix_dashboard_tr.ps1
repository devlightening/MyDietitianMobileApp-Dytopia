$path = 'C:\Users\hy971\source\repos\MyDietitianMobileApp\mobile-app\src\screens\DashboardScreen.tsx'
$text = [System.IO.File]::ReadAllText($path)

$continueReplacement = @'
  const continueCard: ContinueCardModel = (() => {
    if (!(user?.isPremium ?? false)) {
      return {
        eyebrow: language === 'tr' ? 'Sonraki adım' : 'Next move',
        title: language === 'tr' ? 'Premium alanını aç ve planını bağla' : 'Unlock premium and connect your plan',
        body: language === 'tr'
          ? 'Kişisel plan, seri takibi ve su hedefleri tek akışta burada toplanır.'
          : 'Your personal plan, streaks, and hydration goals live here once premium is active.',
        cta: language === 'tr' ? 'Premiumu aç' : 'Open premium',
        icon: 'sparkles-outline',
        accent: theme.accentGold,
        onPress: handleActivate,
      };
    }

    if (nextMealState === 'upcoming' && nextMeal) {
      const mealTitle = nextMeal.title ?? nextMeal.time ?? (language === 'tr' ? 'Sıradaki öğün' : 'Next meal');
      return {
        eyebrow: language === 'tr' ? 'Şimdi devam et' : 'Continue now',
        title: language === 'tr' ? `${mealTitle} seni bekliyor` : `${mealTitle} is up next`,
        body: language === 'tr'
          ? 'Bugünkü akışını kaybetmeden sıradaki öğünü aç ve planını tamamlamaya devam et.'
          : "Jump back into today's flow and keep your plan moving with the next meal.",
        cta: language === 'tr' ? 'Planı aç' : 'Open plan',
        icon: 'restaurant-outline',
        accent: theme.primary,
        onPress: onPressPlans ?? noop,
      };
    }

    if (nextMealState === 'all-complete') {
      return {
        eyebrow: language === 'tr' ? 'Gün tamamlandı' : 'Day complete',
        title: language === 'tr' ? 'Bugünün planını tamamladın' : "You completed today's plan",
        body: language === 'tr'
          ? 'Tüm öğünlerini tamamladın. İstersen planını gözden geçir ya da su hedefini bitirerek günü güçlü kapat.'
          : 'All meals are complete. Review your plan or finish your hydration goal to close the day strong.',
        cta: language === 'tr' ? 'Planımı gör' : 'View my plan',
        icon: 'checkmark-circle-outline',
        accent: theme.emerald,
        onPress: onPressPlans ?? noop,
      };
    }

    if (nextMealState === 'no-plan') {
      return {
        eyebrow: language === 'tr' ? 'Bugün sakin' : 'Quiet day',
        title: language === 'tr' ? 'Bugün için plan görünmüyor' : 'No plan is visible for today',
        body: language === 'tr'
          ? 'Yeni plan yayınlandığında burada göreceksin. Bu arada tariflere göz atabilir veya alışveriş listesini güncelleyebilirsin.'
          : 'You will see your next plan here. For now, you can explore recipes or refresh your shopping list.',
        cta: language === 'tr' ? 'Mutfağı aç' : 'Open kitchen',
        icon: 'leaf-outline',
        accent: theme.emerald,
        onPress: onPressKitchen ?? noop,
      };
    }

    if (waterGlasses < WATER_GOAL) {
      return {
        eyebrow: language === 'tr' ? 'Ritmi koru' : 'Keep the rhythm',
        title: language === 'tr' ? 'Su hedefinden geri kalma' : 'Stay on top of hydration',
        body: language === 'tr'
          ? `${Math.max(WATER_GOAL - waterGlasses, 0)} bardak daha içersen günlük 2 L hedefini tamamlarsın.`
          : `${Math.max(WATER_GOAL - waterGlasses, 0)} more glasses gets you to today's 2 L goal.`,
        cta: language === 'tr' ? 'Su ekranına git' : 'Open hydration',
        icon: 'water-outline',
        accent: '#38BDF8',
        onPress: handleOpenWater,
      };
    }

    if (data?.dietitianNote && onPressMessages) {
      return {
        eyebrow: language === 'tr' ? 'Yeni not' : 'New note',
        title: language === 'tr' ? 'Diyetisyeninden gelen notu kontrol et' : 'Check the latest note from your dietitian',
        body: language === 'tr'
          ? 'Günün ritmini korumak için mesajlarını gözden geçir ve gereken yanıtı ver.'
          : 'Review your latest message and reply if anything needs your attention.',
        cta: language === 'tr' ? 'Mesajları aç' : 'Open messages',
        icon: 'chatbubble-ellipses-outline',
        accent: theme.accent,
        onPress: onPressMessages,
      };
    }

    if (activePlan) {
      return {
        eyebrow: language === 'tr' ? 'Plan görünümü' : 'Plan view',
        title: language === 'tr' ? 'Bugünkü akışını kontrol et' : "Review today's flow",
        body: language === 'tr'
          ? 'Tamamlanan, bekleyen ve alternatif öğünlerini tek yerden gözden geçir.'
          : 'See completed, pending, and alternative meals together in one calm timeline.',
        cta: language === 'tr' ? 'Planımı aç' : 'Open my plan',
        icon: 'calendar-outline',
        accent: theme.emerald,
        onPress: onPressPlans ?? noop,
      };
    }

    return {
      eyebrow: language === 'tr' ? 'Keşfet' : 'Explore',
      title: language === 'tr' ? 'Mutfağa dön ve yeni bir tarif seç' : 'Head to the kitchen and pick a new recipe',
      body: language === 'tr'
        ? 'Bugün için sakin bir tarif turu yap, malzemelerine göre yeni seçenekler keşfet.'
        : 'Take a calm recipe pass and discover new options based on what you have.',
      cta: language === 'tr' ? 'Mutfağı aç' : 'Open kitchen',
      icon: 'leaf-outline',
      accent: theme.emerald,
      onPress: onPressKitchen ?? noop,
    };
  })();
'@

$text = [regex]::Replace(
  $text,
  '(?s)  const continueCard: ContinueCardModel = \(\(\) => \{.*?^  \}\)\(\);',
  $continueReplacement,
  [System.Text.RegularExpressions.RegexOptions]::Multiline
)

$replacementTable = @'
GÃ¼nlÃ¼k Ritim	Günlük Ritim
title={user?.isPremium ? "BugÃƒÆ’Ã‚Â¼n iÃƒÆ’Ã‚Â§in iyi bir ritim kur." : "MyDietitian'a yeni bir gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼m geldi."}	title={user?.isPremium ? "Bugün için iyi bir ritim kur." : "MyDietitian'a yeni bir görünüm geldi."}
subtitle={user?.isPremium ? "PlanÃƒâ€Ã‚Â±n, ÃƒÆ’Ã‚Â¶lÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼mlerin ve tarif akÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±n tek bir merkezde." : "Tarifleri keÃƒâ€¦Ã…Â¸fet, profilini hazÃƒâ€Ã‚Â±rla ve premium plana daha gÃƒÆ’Ã‚Â¼ÃƒÆ’Ã‚Â§lÃƒÆ’Ã‚Â¼ bir deneyimle geÃƒÆ’Ã‚Â§."}	subtitle={user?.isPremium ? "Planın, ölçümlerin ve tarif akışın tek bir merkezde." : "Tarifleri keşfet, profilini hazırla ve premium plana daha güçlü bir deneyimle geç."}
{language === 'tr' ? 'BUGÃƒÆ’Ã…â€œN PANELÃƒâ€Ã‚Â°' : 'TODAY PANEL'}	{language === 'tr' ? 'BUGÜN PANELİ' : 'TODAY PANEL'}
{language === 'tr' ? 'Tek bakÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta bugÃ¼nÃƒÆ’Ã‚Â¼n resmi' : 'The shape of your day at a glance'}	{language === 'tr' ? 'Tek bakışta bugünün resmi' : 'The shape of your day at a glance'}
{language === 'tr' ? `${pantryCount} dolap ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÂ· ${shoppingSummary.activeCount} eksik` : `${pantryCount} pantry ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÂ· ${shoppingSummary.activeCount} gaps`}	{language === 'tr' ? `${pantryCount} dolap · ${shoppingSummary.activeCount} eksik` : `${pantryCount} pantry · ${shoppingSummary.activeCount} gaps`}
{language === 'tr' ? 'BUGÃƒÆ’Ã…â€œNÃƒÆ’Ã…â€œ KURTAR' : 'RESCUE TODAY'}	{language === 'tr' ? 'BUGÜNÜ KURTAR' : 'RESCUE TODAY'}
{language === 'tr' ? 'Aktif PlanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±n' : 'Your Active Plan'}	{language === 'tr' ? 'Aktif Planın' : 'Your Active Plan'}
{plan.startDate && plan.endDate ? ' ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ' : ''}	{plan.startDate && plan.endDate ? ' → ' : ''}
{language === 'tr' ? `${plan.completedMeals}/${plan.mealCount} ÃƒÆ’Ã‚Â¶Ãƒâ€Ã…Â¸ÃƒÆ’Ã‚Â¼n` : `${plan.completedMeals}/${plan.mealCount} meals`}	{language === 'tr' ? `${plan.completedMeals}/${plan.mealCount} öğün` : `${plan.completedMeals}/${plan.mealCount} meals`}
{language === 'tr' ? 'HenÃƒÆ’Ã‚Â¼z aktif planÃƒâ€Ã‚Â±n yok' : 'No active plan yet'}	{language === 'tr' ? 'Henüz aktif planın yok' : 'No active plan yet'}
? 'Diyetisyenin sana bir plan atadÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda burada gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼r.'	? 'Diyetisyenin sana bir plan atadığında burada görünür.'
label: language === 'tr' ? 'aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±k rozet' : 'live badges',	label: language === 'tr' ? 'açık rozet' : 'live badges',
label: language === 'tr' ? 'dolap gÃƒÆ’Ã‚Â¶revi' : 'pantry quest',	label: language === 'tr' ? 'dolap görevi' : 'pantry quest',
{language === 'tr' ? 'SERÃƒâ€Ã‚Â° ALANI' : 'STREAK LANE'}	{language === 'tr' ? 'SERİ ALANI' : 'STREAK LANE'}
TÃƒÆ’Ã‚Â¼m NotlarÃƒâ€Ã‚Â±m	Tüm Notlarım
Son ÃƒÆ’Ã¢â‚¬â€œlÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼mler	Son Ölçümler
KalÃƒÆ’Ã‚Â§a	Kalça
GÃƒÆ’Ã‚Â¶Ãƒâ€Ã…Â¸ÃƒÆ’Ã‚Â¼s	Göğüs
ÃƒÆ’Ã¢â‚¬â€œlÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼mlerim	Ölçümlerim
HenÃƒÆ’Ã‚Â¼z ÃƒÆ’Ã‚Â¶lÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼m kaydedilmedi	Henüz ölçüm kaydedilmedi
ÃƒÆ’Ã¢â‚¬â€œlÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼m Ekle	Ölçüm Ekle
Mutfak AsistanÄ±	Mutfak Asistanı
Malzemelerinden tarif ÃƒÆ’Ã‚Â¶ner	Malzemelerinden tarif önerir
DolabÃƒâ€Ã‚Â±m	Dolabım
Evdeki malzemeleri dÃƒÆ’Ã‚Â¼zenle ve hazÃƒâ€Ã‚Â±r tut	Evdeki malzemeleri düzenle ve hazır tut
KullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â± ID	Kullanıcı ID
Premium'a YÃƒÆ’Ã‚Â¼kselt	Premium'a Yükselt
Diyetisyeninle baÃƒâ€Ã…Â¸lan, kiÃƒâ€¦Ã…Â¸isel plan al	Diyetisyeninle bağlan, kişisel plan al
Bel, kalÃƒÆ’Ã‚Â§a, gÃƒÆ’Ã‚Â¶Ãƒâ€Ã…Â¸ÃƒÆ’Ã‚Â¼s takibi	Bel, kalça, göğüs takibi
'@

foreach ($line in ($replacementTable -split "`r?`n")) {
  if (-not $line -or -not $line.Contains("`t")) { continue }
  $pair = $line -split "`t", 2
  $text = $text.Replace($pair[0], $pair[1])
}

[System.IO.File]::WriteAllText($path, $text, [System.Text.UTF8Encoding]::new($false))
