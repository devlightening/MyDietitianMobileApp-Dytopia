import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { getDailyGames, submitDailyGame, type DailyGameChallenge, type SubmitGameResponse } from "../api/games";
import { BRAND_LOGO, preloadBrandAssets } from "../assets/brandAssets";
import PressableScale from "../components/ui/PressableScale";
import DytopiaLogoBubble from "../components/decor/DytopiaLogoBubble";
import { useFeedback } from "../context/FeedbackContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "../context/I18nContext";
import { Routes } from "../navigation/routes";
import { queryClient } from "../queries/queryClient";
import { radii, spacing } from "../theme/tokens";

type MemoryCard = {
  id: string;
  pairId: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  color?: string;
  imageUrl?: string;
  isJoker?: boolean;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: Array<{ id: string; text: string }>;
};

type WordItem = {
  id: string;
  clue: string;
  scrambled: string;
  length: number;
};

type GuessItem = {
  id: string;
  maskedName: string;
  category: string;
  color?: string;
  emoji?: string;
  clues: string[];
  options: Array<{ id: string; text: string; emoji?: string }>;
};

type MarketRunnerItem = {
  id: string;
  label: string;
  emoji?: string;
  lane?: number;
  spawnTick?: number;
  speed?: number;
  isTarget?: boolean;
  category?: string;
  color?: string;
};

type ActiveMarketRunnerItem = MarketRunnerItem & {
  y: number;
};

function gameIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "memory") return "grid-outline";
  if (type === "quiz") return "help-circle-outline";
  if (type === "guess") return "search-outline";
  if (type === "market") return "storefront-outline";
  return "text-outline";
}

function gameTone(theme: import("../theme/tokens").Theme, type: string) {
  if (type === "memory") return theme.accentCyan;
  if (type === "quiz") return theme.accentGold;
  if (type === "guess") return theme.accentCoral;
  if (type === "market") return theme.emerald;
  return theme.primary;
}

function nowSeconds(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

function difficultyLabel(difficulty: string | undefined, language: "tr" | "en") {
  const normalized = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  if (language === "en") {
    return normalized === "hard" ? "hard" : normalized === "medium" ? "medium" : "easy";
  }
  return normalized === "hard" ? "zor" : normalized === "medium" ? "orta" : "kolay";
}

function difficultyHeroCopy(difficulty: string | undefined, language: "tr" | "en") {
  const normalized = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  if (language === "en") {
    if (normalized === "hard") {
      return {
        title: "Master arena",
        body: "Today's questions are sharper because your recent rhythm is strong. A fresh pack opens tomorrow.",
      };
    }
    if (normalized === "medium") {
      return {
        title: "The rhythm is rising",
        body: "Your daily games are getting a little smarter. Finish 4 games and keep the streak warm.",
      };
    }
    return {
      title: "Today's warm-up arena",
      body: "Short, friendly games prepare today's badge run. New questions arrive tomorrow.",
    };
  }

  if (normalized === "hard") {
    return {
      title: "Usta meydanı",
      body: "Son ritmin güçlü olduğu için bugünün soruları daha keskin. Yeni paket yarın açılacak.",
    };
  }
  if (normalized === "medium") {
    return {
      title: "Ritim yükseliyor",
      body: "Günlük oyunlar biraz daha akıllandı. 5 oyunu bitir, seriyi sıcak tut.",
    };
  }
  return {
    title: "Bugünün ısınma meydanı",
    body: "Kısa ve dost canlısı oyunlar bugünkü rozet koşusunu hazırlar. Yeni sorular yarın gelir.",
  };
}

export default function GameCenterScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { language } = useTranslation();
  const { showToast, showDialog, playFeedback } = useFeedback();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SubmitGameResponse | null>(null);

  useEffect(() => {
    void preloadBrandAssets();
  }, []);

  const dailyQuery = useQuery({
    queryKey: ["daily-games", language],
    queryFn: () => getDailyGames(language),
    staleTime: 45_000,
  });

  const selectedChallenge = useMemo(
    () => dailyQuery.data?.challenges.find((challenge) => challenge.id === selectedId) ?? null,
    [dailyQuery.data?.challenges, selectedId],
  );

  useEffect(() => {
    if (!dailyQuery.data || selectedId) return;
    const firstOpen = dailyQuery.data.challenges.find((challenge) => challenge.status !== "completed");
    setSelectedId((firstOpen ?? dailyQuery.data.challenges[0])?.id ?? null);
  }, [dailyQuery.data, selectedId]);

  const submitMutation = useMutation({
    mutationFn: ({ challenge, answers, moves, durationSeconds }: {
      challenge: DailyGameChallenge;
      answers: any;
      moves: number;
      durationSeconds: number;
    }) => submitDailyGame(challenge.id, { answers, moves, durationSeconds }),
    onSuccess: async (result) => {
      setLastResult(result);
      playFeedback(result.perfect ? "success" : "light");
      await queryClient.invalidateQueries({ queryKey: ["daily-games"] });
      await queryClient.invalidateQueries({ queryKey: ["gamification"] });

      if (result.earnedBadgeIds.includes("game_monster")) {
        showDialog({
          variant: "success",
          icon: "trophy-outline",
          eyebrow: language === "tr" ? "Yeni rozet" : "New badge",
          title: language === "tr" ? "Oyun Canavarı açıldı!" : "Game Monster unlocked!",
          message: language === "tr"
            ? "Bugünün 5 mini oyununu bitirdin. Rozet kasasına şahane bir parça eklendi."
            : "You finished today's 5 mini games. A fresh badge joined your vault.",
          primaryAction: { label: language === "tr" ? "Harika" : "Nice", icon: "sparkles-outline" },
        });
      } else {
        showToast({
          variant: "success",
          title: result.perfect
            ? (language === "tr" ? "Kusursuz oyun!" : "Perfect game!")
            : (language === "tr" ? "Oyun tamamlandı" : "Game complete"),
          message: `${result.score}/${result.maxScore}`,
        });
      }
    },
    onError: () => {
      showToast({
        variant: "error",
        title: language === "tr" ? "Skor kaydedilemedi" : "Score not saved",
        message: language === "tr" ? "Bağlantıyı kontrol edip tekrar deneyelim." : "Check the connection and try again.",
      });
    },
  });

  function submitChallenge(challenge: DailyGameChallenge, answers: any, moves: number, durationSeconds: number) {
    if (submitMutation.isPending) return;
    submitMutation.mutate({ challenge, answers, moves, durationSeconds });
  }

  const progress = dailyQuery.data
    ? Math.min(1, dailyQuery.data.completedCount / Math.max(1, dailyQuery.data.totalCount))
    : 0;
  const dailyDifficulty = dailyQuery.data?.difficulty ?? "easy";
  const heroCopy = difficultyHeroCopy(dailyDifficulty, language);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <DytopiaLogoBubble size={220} opacity={0.24} logoOpacity={0.32} style={s.bgLogoA} />
      <DytopiaLogoBubble size={150} opacity={0.18} logoOpacity={0.3} style={s.bgLogoB} />

      <View style={s.header}>
        <PressableScale
          style={[s.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerEyebrow, { color: theme.primary }]}>
            {language === "tr" ? "MUTFAK OYUNLARI" : "KITCHEN GAMES"}
          </Text>
          <Text style={[s.headerTitle, { color: theme.text }]}>
            {language === "tr" ? "Bugünün mini meydanı" : "Today's mini arena"}
          </Text>
        </View>
        <View style={[s.badgeBubble, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Text style={[s.badgeBubbleValue, { color: theme.primaryDark }]}>
            {dailyQuery.data?.completedCount ?? 0}/{dailyQuery.data?.totalCount ?? 5}
          </Text>
          <Text style={[s.badgeBubbleLabel, { color: theme.textMuted }]}>
            {language === "tr" ? "oyun" : "games"}
          </Text>
        </View>
      </View>

      {dailyQuery.isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[s.loadingText, { color: theme.textMuted }]}>
            {language === "tr" ? "Günün oyunları hazırlanıyor..." : "Preparing today's games..."}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <View style={[s.heroCard, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
              <View style={s.heroTop}>
                <View style={[s.heroIcon, { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald }]}>
                  <Ionicons name="game-controller-outline" size={23} color={theme.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.heroTitle, { color: theme.text }]}>
                    {heroCopy.title}
                  </Text>
                  <Text style={[s.heroBody, { color: theme.textSub }]}>
                    {heroCopy.body}
                  </Text>
                </View>
              </View>
              <View style={[s.difficultyPill, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
                <Text style={[s.difficultyPillText, { color: theme.primaryDark }]}>
                  {difficultyLabel(dailyDifficulty, language)}
                </Text>
              </View>
              <View style={[s.progressTrack, { backgroundColor: theme.borderLight }]}>
                <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.primary }]} />
              </View>
            </View>

            <View style={s.challengeRow}>
              {dailyQuery.data?.challenges.map((challenge) => {
                const accent = gameTone(theme, challenge.type);
                const selected = challenge.id === selectedId;
                const completed = challenge.status === "completed";
                const statusLabel = completed
                  ? language === "tr" ? "Bitti" : "Done"
                  : selected
                    ? language === "tr" ? "Açık" : "Open"
                    : language === "tr" ? "Seç" : "Pick";
                const helperText = completed
                  ? language === "tr" ? "Bugün tamamlandı, skorun saklandı." : "Completed today, score saved."
                  : challenge.subtitle;
                return (
                  <PressableScale
                    key={challenge.id}
                    pressedScale={0.95}
                    style={[
                      s.challengePill,
                      {
                        backgroundColor: selected ? `${accent}15` : completed ? `${accent}0F` : theme.surface,
                        borderColor: selected ? `${accent}66` : completed ? `${accent}30` : theme.border,
                      },
                    ]}
                    onPress={() => {
                      setLastResult(null);
                      setSelectedId(challenge.id);
                    }}
                  >
                    <View style={[s.challengeRail, { backgroundColor: selected ? accent : `${accent}45` }]} />
                    <View style={[s.challengeIconWrap, { backgroundColor: `${accent}16`, borderColor: `${accent}38` }]}>
                      <Ionicons name={completed ? "checkmark-circle" : gameIcon(challenge.type)} size={22} color={accent} />
                    </View>
                    <View style={s.challengeTextWrap}>
                      <Text style={[s.challengePillText, { color: selected ? accent : theme.text }]} numberOfLines={1}>
                        {challenge.title}
                      </Text>
                      <Text style={[s.challengeSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                        {helperText}
                      </Text>
                    </View>
                    <View style={[s.challengeStatusChip, { backgroundColor: `${accent}12`, borderColor: `${accent}35` }]}>
                      <Text style={[s.challengeStatusText, { color: accent }]}>{statusLabel}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            {lastResult ? <ResultCard result={lastResult} theme={theme} language={language} /> : null}

            {selectedChallenge ? (
              <GameBoard
                challenge={selectedChallenge}
                theme={theme}
                language={language}
                pending={submitMutation.isPending}
                onSubmit={(answers, moves, durationSeconds) => submitChallenge(selectedChallenge, answers, moves, durationSeconds)}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function ResultCard({
  result,
  theme,
  language,
}: {
  result: SubmitGameResponse;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
}) {
  const ratio = Math.min(1, result.score / Math.max(1, result.maxScore));
  return (
    <View style={[s.resultCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
      <View style={[s.resultIcon, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
        <Ionicons name={result.perfect ? "sparkles-outline" : "checkmark-circle-outline"} size={20} color={theme.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.resultTitle, { color: theme.text }]}>
          {result.perfect
            ? (language === "tr" ? "Kusursuz tur!" : "Perfect run!")
            : (language === "tr" ? "Skor kaydedildi" : "Score saved")}
        </Text>
        <Text style={[s.resultBody, { color: theme.textSub }]}>{result.explanation}</Text>
        <View style={[s.resultTrack, { backgroundColor: theme.borderLight }]}>
          <View style={[s.resultFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: theme.primary }]} />
        </View>
      </View>
      <Text style={[s.resultScore, { color: theme.primaryDark }]}>{result.score}</Text>
    </View>
  );
}

function GameBoard({
  challenge,
  theme,
  language,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const accent = gameTone(theme, challenge.type);
  return (
    <View style={[s.boardCard, { backgroundColor: theme.surface, borderColor: `${accent}35` }]}>
      <View style={s.boardHeader}>
        <View style={[s.boardIcon, { backgroundColor: `${accent}16`, borderColor: `${accent}35` }]}>
          <Ionicons name={gameIcon(challenge.type)} size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.boardTitle, { color: theme.text }]}>{challenge.title}</Text>
          <Text style={[s.boardSubtitle, { color: theme.textMuted }]}>{challenge.subtitle}</Text>
        </View>
        <View style={[s.easyPill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[s.easyPillText, { color: theme.primaryDark }]}>
            {difficultyLabel(challenge.difficulty, language)}
          </Text>
        </View>
      </View>

      {challenge.status === "completed" ? (
        <View style={[s.completedBoard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Ionicons name="checkmark-done-circle-outline" size={30} color={theme.primaryDark} />
          <Text style={[s.completedTitle, { color: theme.text }]}>
            {language === "tr" ? "Bu oyun bugün tamamlandı" : "This game is complete today"}
          </Text>
          <Text style={[s.completedBody, { color: theme.textMuted }]}>
            {language === "tr"
              ? "Bugünün turu tamamlandı. Yeni sorular yarın zorluk seviyene göre gelecek."
              : "Today's run is complete. New questions arrive tomorrow based on your difficulty level."}
          </Text>
        </View>
      ) : challenge.type === "memory" ? (
        <MemoryGame challenge={challenge} theme={theme} pending={pending} onSubmit={onSubmit} />
      ) : challenge.type === "quiz" ? (
        <QuizGame challenge={challenge} theme={theme} language={language} pending={pending} onSubmit={onSubmit} />
      ) : challenge.type === "word" ? (
        <WordGame challenge={challenge} theme={theme} language={language} pending={pending} onSubmit={onSubmit} />
      ) : challenge.type === "market" ? (
        <MarketRunGame challenge={challenge} theme={theme} language={language} pending={pending} onSubmit={onSubmit} />
      ) : (
        <GuessGame challenge={challenge} theme={theme} language={language} pending={pending} onSubmit={onSubmit} />
      )}
    </View>
  );
}

function MemoryGame({
  challenge,
  theme,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const cards = (challenge.payload?.cards ?? []) as MemoryCard[];
  const { width } = useWindowDimensions();
  const gridSize = Math.max(2, Math.min(5, Number(challenge.payload?.gridSize ?? 4)));
  const cardGap = 9;
  const boardWidth = Math.min(420, Math.max(260, width - spacing.base * 4 - 30));
  const cardWidth = Math.floor((boardWidth - cardGap * (gridSize - 1)) / gridSize);
  const pairCount = useMemo(() => new Set(cards.filter(card => !card.isJoker).map(card => card.pairId)).size, [cards]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [jokerIds, setJokerIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    setFlippedIds([]);
    setMatchedPairIds([]);
    setJokerIds([]);
    setMoves(0);
    setBusy(false);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
  }, [challenge.id]);

  function pressCard(card: MemoryCard) {
    if (busy || pending || submittedRef.current) return;
    if (matchedPairIds.includes(card.pairId) || jokerIds.includes(card.id) || flippedIds.includes(card.id)) return;

    if (card.isJoker) {
      setJokerIds((current) => [...current, card.id]);
      return;
    }

    if (flippedIds.length === 0) {
      setFlippedIds([card.id]);
      return;
    }

    const first = cards.find(item => item.id === flippedIds[0]);
    if (!first) {
      setFlippedIds([card.id]);
      return;
    }

    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setFlippedIds([first.id, card.id]);

    if (first.pairId === card.pairId && first.id !== card.id) {
      const nextMatched = [...matchedPairIds, card.pairId];
      setMatchedPairIds(nextMatched);
      setFlippedIds([]);
      if (nextMatched.length >= pairCount) {
        submittedRef.current = true;
        onSubmit({ matchedPairIds: nextMatched }, nextMoves, nowSeconds(startedAtRef.current));
      }
      return;
    }

    setBusy(true);
    setTimeout(() => {
      setFlippedIds([]);
      setBusy(false);
    }, 1000);
  }

  return (
    <View>
      <Text style={[s.gameHint, { color: theme.textSub }]}>{challenge.payload?.hint}</Text>
      <View style={[s.memoryGrid, { width: boardWidth, gap: cardGap }]}>
        {cards.map((card) => {
          const revealed = flippedIds.includes(card.id) || matchedPairIds.includes(card.pairId) || jokerIds.includes(card.id);
          return (
            <MemoryFlipCard
              key={card.id}
              card={card}
              revealed={revealed}
              matched={matchedPairIds.includes(card.pairId) || jokerIds.includes(card.id)}
              size={cardWidth}
              theme={theme}
              onPress={() => pressCard(card)}
            />
          );
        })}
      </View>
      <View style={s.gameMetaRow}>
        <Text style={[s.gameMeta, { color: theme.textMuted }]}>Eşleşen {matchedPairIds.length}/{pairCount}</Text>
        <Text style={[s.gameMeta, { color: theme.textMuted }]}>Hamle {moves}</Text>
      </View>
    </View>
  );
}

function MemoryFlipCard({
  card,
  revealed,
  matched,
  size,
  theme,
  onPress,
}: {
  card: MemoryCard;
  revealed: boolean;
  matched: boolean;
  size: number;
  theme: import("../theme/tokens").Theme;
  onPress: () => void;
}) {
  const progress = useSharedValue(revealed ? 1 : 0);
  const accent = card.color ?? theme.primary;
  const brandMarkSize = Math.max(36, Math.min(52, size * 0.58));
  const brandLogoSize = Math.round(brandMarkSize * 0.82);

  useEffect(() => {
    progress.value = withTiming(revealed ? 1 : 0, { duration: 360 });
  }, [progress, revealed]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
      { scale: interpolate(progress.value, [0, 1], [1, 0.98]) },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(progress.value, [0, 1], [-180, 0])}deg` },
      { scale: interpolate(progress.value, [0, 1], [0.98, 1]) },
    ],
  }));

  return (
    <PressableScale
      pressedScale={0.94}
      style={[s.memoryCardPressable, { width: size, height: Math.round(size * 1.28) }]}
      onPress={onPress}
    >
      <View style={s.memoryFlipShell}>
        <Animated.View
          style={[
            s.memoryFace,
            s.memoryFrontFace,
            { backgroundColor: theme.primaryLight, borderColor: theme.borderEmerald },
            frontStyle,
          ]}
        >
          <View
            style={[
              s.memoryBrandGlow,
              {
                width: brandMarkSize * 1.26,
                height: brandMarkSize * 1.26,
                borderRadius: brandMarkSize * 0.4,
                backgroundColor: `${theme.primary}10`,
              },
            ]}
          />
          <View
            style={[
              s.memoryBrandMark,
              {
                width: brandMarkSize,
                height: brandMarkSize,
                borderRadius: brandMarkSize * 0.3,
                borderColor: `${theme.primary}24`,
                backgroundColor: theme.primaryLight,
              },
            ]}
          >
            <Image
              source={BRAND_LOGO}
              resizeMode="contain"
              fadeDuration={0}
              style={{
                width: brandLogoSize,
                height: brandLogoSize,
                borderRadius: brandMarkSize * 0.18,
              }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            s.memoryFace,
            s.memoryBackFace,
            { backgroundColor: "#FFFFFF", borderColor: matched ? `${accent}88` : `${accent}45` },
            backStyle,
          ]}
        >
          <View style={[s.memoryImagePlate, { backgroundColor: `${accent}16` }]}>
            {card.imageUrl ? (
              <Image source={{ uri: card.imageUrl }} style={s.memoryImage} resizeMode="cover" />
            ) : (
              <Text style={s.memoryEmoji}>{card.emoji ?? "🥗"}</Text>
            )}
          </View>
          <Text style={[s.memoryLabel, { color: theme.text }]} numberOfLines={1}>
            {card.label}
          </Text>
          {matched ? (
            <View style={[s.memoryMatchedDot, { backgroundColor: accent }]}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </PressableScale>
  );
}

function QuizGame({
  challenge,
  theme,
  language,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const questions = (challenge.payload?.questions ?? []) as QuizQuestion[];
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Array<{ questionId: string; optionId: string }>>([]);
  const startedAtRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const current = questions[index];

  useEffect(() => {
    setIndex(0);
    setResponses([]);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
  }, [challenge.id]);

  function selectOption(optionId: string) {
    if (!current || pending || submittedRef.current) return;
    const nextResponses = [...responses.filter(item => item.questionId !== current.id), { questionId: current.id, optionId }];
    setResponses(nextResponses);

    if (index >= questions.length - 1) {
      submittedRef.current = true;
      setTimeout(() => onSubmit({ responses: nextResponses }, questions.length, nowSeconds(startedAtRef.current)), 220);
      return;
    }

    setTimeout(() => setIndex((value) => Math.min(value + 1, questions.length - 1)), 180);
  }

  if (!current) return null;

  return (
    <View>
      <View style={s.quizProgressRow}>
        <Text style={[s.gameMeta, { color: theme.textMuted }]}>
          {language === "tr" ? "Soru" : "Question"} {index + 1}/{questions.length}
        </Text>
        <View style={[s.quizMiniTrack, { backgroundColor: theme.borderLight }]}>
          <View style={[s.quizMiniFill, { width: `${((index + 1) / questions.length) * 100}%`, backgroundColor: theme.accentGold }]} />
        </View>
      </View>
      <Text style={[s.questionText, { color: theme.text }]}>{current.question}</Text>
      <View style={s.optionList}>
        {current.options.map((option) => (
          <PressableScale
            key={option.id}
            style={[s.optionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => selectOption(option.id)}
          >
            <View style={[s.optionBullet, { backgroundColor: `${theme.accentGold}18` }]}>
              <Text style={[s.optionBulletText, { color: theme.accentGold }]}>{option.id.toUpperCase()}</Text>
            </View>
            <Text style={[s.optionText, { color: theme.text }]}>{option.text}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function WordGame({
  challenge,
  theme,
  language,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const words = (challenge.payload?.words ?? []) as WordItem[];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    setAnswers({});
    startedAtRef.current = Date.now();
  }, [challenge.id]);

  const filledCount = words.filter(word => (answers[word.id] ?? "").trim().length > 0).length;
  const ready = words.length > 0 && filledCount === words.length;

  return (
    <View>
      <Text style={[s.gameHint, { color: theme.textSub }]}>
        {language === "tr" ? "Karışık harfleri çöz, kelime dolabını tamamla." : "Unscramble the letters and complete the word pantry."}
      </Text>
      <View style={s.wordList}>
        {words.map((word) => (
          <View key={word.id} style={[s.wordCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <View style={s.wordTop}>
              <Text style={[s.scrambledText, { color: theme.primaryDark }]}>{word.scrambled}</Text>
              <Text style={[s.wordLength, { color: theme.textMuted }]}>{word.length} harf</Text>
            </View>
            <Text style={[s.wordClue, { color: theme.textSub }]}>{word.clue}</Text>
            <TextInput
              value={answers[word.id] ?? ""}
              onChangeText={(text) => setAnswers((current) => ({ ...current, [word.id]: text }))}
              placeholder={language === "tr" ? "Cevabın" : "Your answer"}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.wordInput, { color: theme.text, borderColor: theme.borderEmerald, backgroundColor: theme.surface }]}
            />
          </View>
        ))}
      </View>
      <PressableScale
        disabled={!ready || pending}
        style={[
          s.submitButton,
          { backgroundColor: ready ? theme.primary : theme.surfaceElevated, opacity: ready ? 1 : 0.7 },
        ]}
        onPress={() => onSubmit(
          { words: words.map(word => ({ wordId: word.id, answer: answers[word.id] ?? "" })) },
          filledCount,
          nowSeconds(startedAtRef.current),
        )}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={ready ? "#fff" : theme.textMuted} />
        <Text style={[s.submitButtonText, { color: ready ? "#fff" : theme.textMuted }]}>
          {pending ? (language === "tr" ? "Kaydediliyor..." : "Saving...") : (language === "tr" ? "Kelime turunu bitir" : "Finish word run")}
        </Text>
      </PressableScale>
    </View>
  );
}

function GuessGame({
  challenge,
  theme,
  language,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const items = (challenge.payload?.items ?? []) as GuessItem[];
  const [index, setIndex] = useState(0);
  const [revealedHints, setRevealedHints] = useState(1);
  const [responses, setResponses] = useState<Array<{ itemId: string; optionId: string; revealedHints: number }>>([]);
  const startedAtRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const current = items[index];
  const accent = current?.color ?? theme.accentCoral;

  useEffect(() => {
    setIndex(0);
    setRevealedHints(1);
    setResponses([]);
    startedAtRef.current = Date.now();
    submittedRef.current = false;
  }, [challenge.id]);

  function revealNextHint() {
    if (!current || pending || submittedRef.current) return;
    setRevealedHints((value) => Math.min(current.clues.length || 3, value + 1));
  }

  function selectOption(optionId: string) {
    if (!current || pending || submittedRef.current) return;
    const nextResponses = [
      ...responses.filter((item) => item.itemId !== current.id),
      { itemId: current.id, optionId, revealedHints },
    ];
    setResponses(nextResponses);

    if (index >= items.length - 1) {
      submittedRef.current = true;
      setTimeout(() => onSubmit({ guesses: nextResponses }, nextResponses.length + nextResponses.reduce((sum, item) => sum + item.revealedHints, 0), nowSeconds(startedAtRef.current)), 220);
      return;
    }

    setTimeout(() => {
      setIndex((value) => Math.min(value + 1, items.length - 1));
      setRevealedHints(1);
    }, 220);
  }

  if (!current) return null;

  const visibleClues = current.clues.slice(0, Math.max(1, revealedHints));
  const canRevealMore = revealedHints < current.clues.length;

  return (
    <View>
      <Text style={[s.gameHint, { color: theme.textSub }]}>
        {language === "tr"
          ? "İpuçlarını sırayla aç, besini mümkün olduğunca erken tahmin et."
          : "Reveal staged clues and guess the food as early as you can."}
      </Text>

      <View style={[s.guessStage, { backgroundColor: `${accent}12`, borderColor: `${accent}35` }]}>
        <View style={s.guessTopRow}>
          <View style={[s.guessOrb, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
            <Text style={s.guessOrbText}>{current.emoji ?? "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.guessCategory, { color: accent }]}>{current.category}</Text>
            <Text style={[s.guessMasked, { color: theme.text }]}>{current.maskedName}</Text>
          </View>
          <View style={[s.guessCounter, { backgroundColor: theme.surface, borderColor: `${accent}35` }]}>
            <Text style={[s.guessCounterText, { color: accent }]}>{index + 1}/{items.length}</Text>
          </View>
        </View>

        <View style={s.clueList}>
          {visibleClues.map((clue, clueIndex) => (
            <View key={`${current.id}-${clueIndex}`} style={[s.clueCard, { backgroundColor: theme.surface, borderColor: `${accent}30` }]}>
              <View style={[s.clueBadge, { backgroundColor: `${accent}18` }]}>
                <Text style={[s.clueBadgeText, { color: accent }]}>{clueIndex + 1}</Text>
              </View>
              <Text style={[s.clueText, { color: theme.text }]}>{clue}</Text>
            </View>
          ))}
        </View>

        <PressableScale
          disabled={!canRevealMore || pending}
          style={[
            s.revealButton,
            { backgroundColor: canRevealMore ? theme.surface : theme.surfaceElevated, borderColor: `${accent}35`, opacity: canRevealMore ? 1 : 0.72 },
          ]}
          onPress={revealNextHint}
        >
          <Ionicons name={canRevealMore ? "bulb-outline" : "checkmark-circle-outline"} size={16} color={canRevealMore ? accent : theme.textMuted} />
          <Text style={[s.revealButtonText, { color: canRevealMore ? accent : theme.textMuted }]}>
            {canRevealMore
              ? (language === "tr" ? "Bir ipucu daha aç" : "Reveal another clue")
              : (language === "tr" ? "Tüm ipuçları açık" : "All clues revealed")}
          </Text>
        </PressableScale>
      </View>

      <View style={s.guessOptions}>
        {current.options.map((option) => (
          <PressableScale
            key={option.id}
            disabled={pending || submittedRef.current}
            style={[s.guessOptionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => selectOption(option.id)}
          >
            <Text style={s.guessOptionEmoji}>{option.emoji ?? "🍽️"}</Text>
            <Text style={[s.guessOptionText, { color: theme.text }]}>{option.text}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function MarketRunGame({
  challenge,
  theme,
  language,
  pending,
  onSubmit,
}: {
  challenge: DailyGameChallenge;
  theme: import("../theme/tokens").Theme;
  language: "tr" | "en";
  pending: boolean;
  onSubmit: (answers: any, moves: number, durationSeconds: number) => void;
}) {
  const { width } = useWindowDimensions();
  const payload = challenge.payload ?? {};
  const items = useMemo(() => {
    const rawItems = Array.isArray(payload.items) ? payload.items as MarketRunnerItem[] : [];
    return rawItems
      .map((item, index) => ({
        ...item,
        id: item.id || `market-item-${index}`,
        label: item.label || (language === "tr" ? "Urun" : "Item"),
        lane: normalizeMarketLane(item.lane),
        spawnTick: Math.max(0, Number(item.spawnTick ?? index * 5)),
        speed: Math.max(0.045, Math.min(0.1, Number(item.speed ?? 0.068))),
      }))
      .sort((a, b) => (a.spawnTick ?? 0) - (b.spawnTick ?? 0));
  }, [language, payload.items]);
  const targetCount = Math.max(1, Number(payload.targetCount ?? items.filter(item => item.isTarget).length ?? 6));
  const timeLimitSeconds = Math.max(30, Math.min(60, Number(payload.timeLimitSeconds ?? challenge.estimatedSeconds ?? 45)));
  const stageHeight = Math.min(480, Math.max(390, width * 0.96));
  const maxSpawnTick = items.reduce((max, item) => Math.max(max, Number(item.spawnTick ?? 0)), 0);

  const [lane, setLane] = useState(0);
  const [tick, setTick] = useState(0);
  const [activeItems, setActiveItems] = useState<ActiveMarketRunnerItem[]>([]);
  const [collectedIds, setCollectedIds] = useState<string[]>([]);
  const [hitHazardIds, setHitHazardIds] = useState<string[]>([]);
  const [missedTargetIds, setMissedTargetIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [running, setRunning] = useState(true);

  const laneRef = useRef(0);
  const tickRef = useRef(0);
  const movesRef = useRef(0);
  const collectedRef = useRef<string[]>([]);
  const hazardRef = useRef<string[]>([]);
  const missedRef = useRef<string[]>([]);
  const submittedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  useEffect(() => {
    setLane(0);
    setTick(0);
    setActiveItems([]);
    setCollectedIds([]);
    setHitHazardIds([]);
    setMissedTargetIds([]);
    setMoves(0);
    setRunning(true);
    laneRef.current = 0;
    tickRef.current = 0;
    movesRef.current = 0;
    collectedRef.current = [];
    hazardRef.current = [];
    missedRef.current = [];
    submittedRef.current = false;
    startedAtRef.current = Date.now();
  }, [challenge.id]);

  const addUnique = React.useCallback((ref: React.MutableRefObject<string[]>, setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
    if (ref.current.includes(id)) return;
    ref.current = [...ref.current, id];
    setter(ref.current);
  }, []);

  const finishRun = React.useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setRunning(false);
    onSubmit(
      {
        collectedItemIds: collectedRef.current,
        hitHazardIds: hazardRef.current,
        missedTargetIds: missedRef.current,
      },
      movesRef.current,
      nowSeconds(startedAtRef.current),
    );
  }, [onSubmit]);

  useEffect(() => {
    if (!running || pending || items.length === 0 || submittedRef.current) return;

    const timer = setInterval(() => {
      const nextTick = tickRef.current + 1;
      tickRef.current = nextTick;
      setTick(nextTick);

      setActiveItems((current) => {
        const spawned = items
          .filter(item => Math.round(Number(item.spawnTick ?? 0)) === nextTick)
          .map(item => ({ ...item, y: 0 }));
        const nextActive: ActiveMarketRunnerItem[] = [];

        for (const item of [...current, ...spawned]) {
          const nextY = item.y + Number(item.speed ?? 0.068);
          const itemLane = normalizeMarketLane(item.lane);
          const collides = nextY >= 0.74 && nextY <= 0.98 && itemLane === laneRef.current;

          if (collides) {
            if (item.isTarget) {
              addUnique(collectedRef, setCollectedIds, item.id);
            } else {
              addUnique(hazardRef, setHitHazardIds, item.id);
            }
            continue;
          }

          if (nextY >= 1.08) {
            if (item.isTarget) {
              addUnique(missedRef, setMissedTargetIds, item.id);
            }
            continue;
          }

          nextActive.push({ ...item, y: nextY });
        }

        return nextActive;
      });

      const elapsedSeconds = (Date.now() - startedAtRef.current) / 1000;
      if (nextTick > maxSpawnTick + 22 || elapsedSeconds >= timeLimitSeconds) {
        setTimeout(finishRun, 60);
      }
    }, 110);

    return () => clearInterval(timer);
  }, [addUnique, finishRun, items, maxSpawnTick, pending, running, timeLimitSeconds]);

  function moveLane(direction: -1 | 1) {
    if (pending || submittedRef.current) return;
    setLane((current) => {
      const next = Math.max(-1, Math.min(1, current + direction));
      if (next !== current) {
        movesRef.current += 1;
        setMoves(movesRef.current);
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <View style={[s.completedBoard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Ionicons name="storefront-outline" size={30} color={theme.primaryDark} />
        <Text style={[s.completedTitle, { color: theme.text }]}>
          {language === "tr" ? "Market rotası hazırlanamadı" : "Market route is not ready"}
        </Text>
      </View>
    );
  }

  const collectedCount = collectedIds.length;
  const remainingSeconds = Math.max(0, timeLimitSeconds - Math.round((Date.now() - startedAtRef.current) / 1000));

  return (
    <View>
      <View style={[s.marketMissionCard, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.marketMissionTitle, { color: theme.text }]}>
            {payload.missionTitle ?? (language === "tr" ? "Temiz listeyi topla" : "Collect the clean list")}
          </Text>
          <Text style={[s.marketMissionBody, { color: theme.textSub }]}>
            {payload.missionSubtitle ?? (language === "tr" ? "Listedekileri topla, tuzaklardan kaç." : "Grab listed items, avoid distractions.")}
          </Text>
        </View>
        <View style={[s.marketCounter, { backgroundColor: theme.surface, borderColor: theme.borderEmerald }]}>
          <Text style={[s.marketCounterValue, { color: theme.primaryDark }]}>{collectedCount}/{targetCount}</Text>
          <Text style={[s.marketCounterLabel, { color: theme.textMuted }]}>{language === "tr" ? "liste" : "list"}</Text>
        </View>
      </View>

      <View style={[s.marketStage, { height: stageHeight, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[s.marketAisleGlow, { backgroundColor: theme.primaryGlow }]} />
        <View style={[s.marketHorizon, { backgroundColor: `${theme.primaryDark}22` }]} />
        {[-1, 0, 1].map((laneValue) => (
          <View
            key={laneValue}
            style={[
              s.marketLane,
              {
                left: `${laneToLeft(laneValue)}%`,
                borderColor: lane === laneValue ? `${theme.primary}80` : theme.border,
                backgroundColor: lane === laneValue ? `${theme.primary}12` : `${theme.surface}55`,
              },
            ]}
          />
        ))}

        <View style={[s.marketHud, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
          <Text style={[s.marketHudText, { color: theme.textMuted }]}>{language === "tr" ? "Süre" : "Time"} {remainingSeconds}s</Text>
          <Text style={[s.marketHudText, { color: theme.accentCoral }]}>{language === "tr" ? "Tuzak" : "Hits"} {hitHazardIds.length}</Text>
          <Text style={[s.marketHudText, { color: theme.warning }]}>{language === "tr" ? "Kaçan" : "Missed"} {missedTargetIds.length}</Text>
        </View>

        {activeItems.map((item) => {
          const y = Math.max(0, Math.min(1.08, item.y));
          const scale = 0.55 + y * 0.65;
          const top = 42 + y * (stageHeight - 118);
          const itemColor = item.color ?? (item.isTarget ? theme.primary : theme.accentCoral);
          return (
            <View
              key={item.id}
              style={[
                s.marketItem,
                {
                  top,
                  left: `${laneToLeft(normalizeMarketLane(item.lane))}%`,
                  marginLeft: -39,
                  transform: [{ scale }],
                  backgroundColor: theme.surface,
                  borderColor: item.isTarget ? `${theme.primary}75` : `${theme.accentCoral}55`,
                  shadowColor: itemColor,
                  zIndex: Math.round(y * 100),
                },
              ]}
            >
              <Text style={s.marketItemEmoji}>{item.emoji ?? (item.isTarget ? "🥬" : "🥤")}</Text>
              <Text style={[s.marketItemLabel, { color: theme.text }]} numberOfLines={1}>{item.label}</Text>
              <View style={[s.marketItemTag, { backgroundColor: `${itemColor}18` }]}>
                <Ionicons name={item.isTarget ? "checkmark" : "close"} size={10} color={itemColor} />
              </View>
            </View>
          );
        })}

        <View
          style={[
            s.marketPlayer,
            {
              left: `${laneToLeft(lane)}%`,
              marginLeft: -36,
              top: stageHeight - 92,
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
        >
          <Ionicons name="basket" size={27} color="#fff" />
          <Text style={s.marketPlayerText}>{language === "tr" ? "SEPET" : "CART"}</Text>
        </View>
      </View>

      <View style={s.marketControls}>
        <PressableScale
          disabled={pending || lane === -1 || submittedRef.current}
          style={[s.marketControlBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: lane === -1 ? 0.45 : 1 }]}
          onPress={() => moveLane(-1)}
        >
          <Ionicons name="chevron-back" size={22} color={theme.primaryDark} />
        </PressableScale>
        <View style={[s.marketControlStatus, { backgroundColor: theme.glassEmerald, borderColor: theme.borderEmerald }]}>
          <Text style={[s.marketControlStatusText, { color: theme.text }]}>
            {running && !pending ? (language === "tr" ? "Koşu sürüyor" : "Running") : (language === "tr" ? "Kaydediliyor" : "Saving")}
          </Text>
          <Text style={[s.marketControlMeta, { color: theme.textMuted }]}>
            {language === "tr" ? "Hamle" : "Moves"} {moves}
          </Text>
        </View>
        <PressableScale
          disabled={pending || lane === 1 || submittedRef.current}
          style={[s.marketControlBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: lane === 1 ? 0.45 : 1 }]}
          onPress={() => moveLane(1)}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.primaryDark} />
        </PressableScale>
      </View>
    </View>
  );
}

function normalizeMarketLane(value: unknown): -1 | 0 | 1 {
  const numeric = Number(value);
  if (numeric <= -1) return -1;
  if (numeric >= 1) return 1;
  return 0;
}

function laneToLeft(lane: number) {
  if (lane <= -1) return 22;
  if (lane >= 1) return 78;
  return 50;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bgLogoA: { position: "absolute", top: 72, right: -64, width: 220, height: 220, borderRadius: 110 },
  bgLogoB: { position: "absolute", bottom: 90, left: -64, width: 150, height: 150, borderRadius: 75 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.base, paddingTop: 8, paddingBottom: 10 },
  backButton: { width: 44, height: 44, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerEyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  badgeBubble: { minWidth: 58, borderRadius: 20, borderWidth: 1, alignItems: "center", paddingHorizontal: 10, paddingVertical: 7 },
  badgeBubbleValue: { fontSize: 17, fontWeight: "900" },
  badgeBubbleLabel: { fontSize: 10, fontWeight: "700" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontWeight: "700" },
  scroll: { paddingHorizontal: spacing.base, paddingBottom: 150, gap: spacing.sm },
  heroCard: { borderWidth: 1, borderRadius: radii.xxl, padding: 15, overflow: "hidden", gap: 12 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  heroIcon: { width: 48, height: 48, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 18, fontWeight: "900", lineHeight: 23 },
  heroBody: { fontSize: 12.5, lineHeight: 18, marginTop: 3, fontWeight: "600" },
  difficultyPill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  difficultyPillText: { fontSize: 10.5, fontWeight: "900" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  challengeRow: { gap: 10 },
  challengePill: {
    minHeight: 68,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 13,
    paddingRight: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  challengeRail: { position: "absolute", left: 0, top: 12, bottom: 12, width: 5, borderTopRightRadius: 999, borderBottomRightRadius: 999 },
  challengeIconWrap: { width: 44, height: 44, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  challengeTextWrap: { flex: 1, minWidth: 0 },
  challengePillText: { fontSize: 14.5, fontWeight: "900", letterSpacing: -0.1 },
  challengeSubtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2, fontWeight: "700" },
  challengeStatusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  challengeStatusText: { fontSize: 10.5, fontWeight: "900" },
  resultCard: { borderWidth: 1, borderRadius: 24, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" },
  resultIcon: { width: 42, height: 42, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 15, fontWeight: "900" },
  resultBody: { fontSize: 12, lineHeight: 17, marginTop: 2, fontWeight: "600" },
  resultTrack: { height: 5, borderRadius: 999, marginTop: 8, overflow: "hidden" },
  resultFill: { height: "100%", borderRadius: 999 },
  resultScore: { fontSize: 28, fontWeight: "900" },
  boardCard: { borderRadius: radii.xxl, borderWidth: 1, padding: 14, gap: 14 },
  boardHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  boardIcon: { width: 44, height: 44, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  boardTitle: { fontSize: 19, fontWeight: "900", lineHeight: 23 },
  boardSubtitle: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  easyPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  easyPillText: { fontSize: 10, fontWeight: "900" },
  completedBoard: { borderRadius: 24, borderWidth: 1, alignItems: "center", padding: 22, gap: 7 },
  completedTitle: { fontSize: 16, fontWeight: "900", textAlign: "center" },
  completedBody: { fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  gameHint: { fontSize: 12.5, lineHeight: 18, fontWeight: "700", marginBottom: 12 },
  memoryGrid: { alignSelf: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  memoryCardPressable: { borderRadius: 18 },
  memoryFlipShell: { flex: 1 },
  memoryFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backfaceVisibility: "hidden",
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
  },
  memoryFrontFace: {},
  memoryBackFace: { padding: 5 },
  memoryBrandGlow: {
    position: "absolute",
    opacity: 0.95,
  },
  memoryBrandMark: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 9,
    elevation: 2,
  },
  memoryImagePlate: {
    width: "82%",
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  memoryImage: { width: "100%", height: "100%", borderRadius: 16 },
  memoryEmoji: { fontSize: 28 },
  memoryLabel: { fontSize: 9.5, fontWeight: "900", textAlign: "center", maxWidth: "94%" },
  memoryMatchedDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  gameMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 11 },
  gameMeta: { fontSize: 12, fontWeight: "800" },
  quizProgressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  quizMiniTrack: { flex: 1, height: 6, borderRadius: 999, overflow: "hidden" },
  quizMiniFill: { height: "100%", borderRadius: 999 },
  questionText: { fontSize: 20, fontWeight: "900", lineHeight: 26, marginBottom: 12 },
  optionList: { gap: 9 },
  optionCard: { minHeight: 58, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 11 },
  optionBullet: { width: 34, height: 34, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optionBulletText: { fontSize: 12, fontWeight: "900" },
  optionText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  wordList: { gap: 10 },
  wordCard: { borderRadius: 22, borderWidth: 1, padding: 12 },
  wordTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  scrambledText: { fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  wordLength: { fontSize: 11, fontWeight: "800" },
  wordClue: { fontSize: 12.5, lineHeight: 18, fontWeight: "700", marginBottom: 9 },
  wordInput: { minHeight: 46, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: "800" },
  submitButton: { marginTop: 12, minHeight: 56, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitButtonText: { fontSize: 14, fontWeight: "900" },
  guessStage: { borderWidth: 1, borderRadius: 28, padding: 14, gap: 12 },
  guessTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  guessOrb: { width: 64, height: 64, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  guessOrbText: { fontSize: 30, fontWeight: "900" },
  guessCategory: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  guessMasked: { fontSize: 24, lineHeight: 28, fontWeight: "900", letterSpacing: 1.1 },
  guessCounter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  guessCounterText: { fontSize: 11, fontWeight: "900" },
  clueList: { gap: 8 },
  clueCard: { minHeight: 48, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  clueBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  clueBadgeText: { fontSize: 12, fontWeight: "900" },
  clueText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  revealButton: { minHeight: 44, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  revealButtonText: { fontSize: 12.5, fontWeight: "900" },
  guessOptions: { gap: 9, marginTop: 12 },
  guessOptionCard: { minHeight: 58, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  guessOptionEmoji: { fontSize: 22 },
  guessOptionText: { flex: 1, fontSize: 14.5, fontWeight: "900" },
  marketMissionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  marketMissionTitle: { fontSize: 16, fontWeight: "900", lineHeight: 20 },
  marketMissionBody: { fontSize: 12.5, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  marketCounter: {
    minWidth: 62,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  marketCounterValue: { fontSize: 18, fontWeight: "900" },
  marketCounterLabel: { fontSize: 10, fontWeight: "800" },
  marketStage: {
    borderWidth: 1,
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 12,
  },
  marketAisleGlow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.5,
  },
  marketHorizon: {
    position: "absolute",
    top: 26,
    alignSelf: "center",
    width: 124,
    height: 24,
    borderRadius: 999,
  },
  marketLane: {
    position: "absolute",
    top: 58,
    bottom: 28,
    width: 72,
    marginLeft: -36,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderRadius: 36,
    transform: [{ perspective: 560 }, { rotateX: "16deg" }, { scaleY: 1.05 }],
  },
  marketHud: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 200,
  },
  marketHudText: { fontSize: 11.5, fontWeight: "900" },
  marketItem: {
    position: "absolute",
    width: 78,
    minHeight: 84,
    borderWidth: 1.4,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  marketItemEmoji: { fontSize: 27, lineHeight: 31 },
  marketItemLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: "900", marginTop: 3, maxWidth: "100%" },
  marketItemTag: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  marketPlayer: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
    zIndex: 250,
  },
  marketPlayerText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 1 },
  marketControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  marketControlStatus: {
    flex: 1,
    minHeight: 56,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  marketControlStatusText: { fontSize: 13.5, fontWeight: "900" },
  marketControlMeta: { fontSize: 11, fontWeight: "800", marginTop: 2 },
});
