#!/bin/bash
set -e

# Parse the complete updater before git reset can replace this file on disk.
main() {

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
REPO_URL="https://github.com/GrabovskyAlexey/mtproto-panel.git"
UPDATE_IMAGE="ghcr.io/grabovskyalexey/mtproto-panel-backend:latest"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTProto Panel - Обновление            ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Парсим аргументы
FORCE_BRANCH=""
UPDATE_ARGS=("$@")
while [[ $# -gt 0 ]]; do
    case "$1" in
        --b=*) FORCE_BRANCH="${1#--b=}"; shift ;;
        --b)
            if [ $# -lt 2 ]; then echo "Ошибка: укажите ветку после --b."; exit 1; fi
            FORCE_BRANCH="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Keep the updater alive when it replaces the backend that launched it.
if [ -f /.dockerenv ] && [ "${UPDATE_WORKER:-0}" != "1" ]; then
    HOST_PROJECT_DIR=$(docker inspect mtproto-panel-backend --format '{{range .Mounts}}{{if eq .Destination "/app/project"}}{{.Source}}{{end}}{{end}}')
    if [ -z "$HOST_PROJECT_DIR" ]; then
        echo -e "${RED}Не найден каталог панели на хосте. Запустите update.sh на сервере.${NC}"
        exit 1
    fi
    docker pull "$UPDATE_IMAGE"
    docker run --detach --rm --name "mtproto-panel-updater-$(date +%s)-$$" \
        --network host --entrypoint /bin/bash \
        --volume /var/run/docker.sock:/var/run/docker.sock \
        --volume "$HOST_PROJECT_DIR:$HOST_PROJECT_DIR" --workdir "$HOST_PROJECT_DIR" \
        --env UPDATE_WORKER=1 "$UPDATE_IMAGE" ./update.sh "${UPDATE_ARGS[@]}"
    echo -e "${GREEN}Обновление запущено в отдельном контейнере.${NC}"
    exit 0
fi

# Проверяем права root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Ошибка: запустите скрипт с правами root (sudo bash update.sh).${NC}"
    exit 1
fi

# Проверяем что мы в директории с docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Ошибка: docker-compose.yml не найден.${NC}"
    echo -e "Запустите скрипт из директории панели (/opt/mtproto-panel)."
    exit 1
fi

# Проверяем что это git-репозиторий (или что родительская директория является им)
GIT_ROOT=$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || git -C ".." rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$GIT_ROOT" ]; then
    echo -e "${RED}Ошибка: не найден git-репозиторий.${NC}"
    echo -e "Панель должна быть установлена через git clone."
    exit 1
fi

# Проверяем наличие .env
if [ ! -f ".env" ]; then
    echo -e "${RED}Ошибка: файл .env не найден.${NC}"
    echo -e "Убедитесь что панель была установлена через install.sh."
    exit 1
fi

PANEL_DIR=$(pwd -P)

echo -e "${CYAN}[1/4] Получение обновлений из репозитория...${NC}"

cd "$GIT_ROOT"

# Runtime files are ignored by git; do not restore an old Compose via stash.
git remote set-url origin "$REPO_URL"

# Определяем ветку (из аргумента или автоматически)
if [ -n "$FORCE_BRANCH" ]; then
    BRANCH="$FORCE_BRANCH"
else
    BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
    BRANCH=${BRANCH:-master}
fi
echo -e "  Ветка: ${YELLOW}${BRANCH}${NC}"
git check-ref-format --branch "$BRANCH" >/dev/null

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo -e "${GREEN}  Обновления получены.${NC}"

# Возвращаемся в директорию панели
cd "$PANEL_DIR"

# Фиксируем имя проекта, чтобы volume pgdata всегда именовался одинаково
# независимо от того, из какой директории запущен скрипт
export COMPOSE_PROJECT_NAME=mtproto-panel

echo -e "${CYAN}[2/4] Загрузка обновлённых образов...${NC}"
if docker compose pull; then
    echo -e "${GREEN}  Образы загружены из реестра.${NC}"
else
    echo -e "${YELLOW}  Не удалось загрузить образы из реестра, собираем локально...${NC}"
    BUILDX_NO_DEFAULT_ATTESTATIONS=1 DOCKER_BUILDKIT=1 docker compose build
fi

echo -e "${CYAN}[3/4] Проверка конфигурации и запуск...${NC}"
docker compose run --rm --no-deps --workdir /app/project --entrypoint node backend /app/project/scripts/migrate-panel-config.mjs

echo -e "${CYAN}  Запуск панели...${NC}"
docker compose up -d --no-build --pull never
echo -e "  Ожидание запуска..."
sleep 5

echo -e "${CYAN}[4/4] Проверка статуса...${NC}"

if [ "$(docker compose ps --status running --services | wc -l | tr -d ' ')" = "3" ]; then
    echo -e "${GREEN}  Панель успешно запущена!${NC}"
else
    echo -e "${RED}Ошибка: один или несколько контейнеров не запустились.${NC}"
    echo -e "Проверьте логи: docker compose logs"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Обновление панели завершено!          ${NC}"
echo -e "${GREEN}========================================${NC}"
}

main "$@"
