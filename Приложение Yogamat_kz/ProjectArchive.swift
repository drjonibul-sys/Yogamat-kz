//
//  ProjectArchive.swift
//  Приложение Yogamat_kz
//

import Foundation

/// Скрипт для Mac, который собирает ZIP всего проекта.
enum ProjectArchive {
    static let scriptName = "Yogamat-kz-архив.sh"

    private static let script = """
    #!/bin/zsh
    # Yogamat.kz — архив материалов приложения.
    #
    # Как собрать:
    #   1. Скопируйте папку проекта на Mac.
    #   2. В Терминале запустите:  zsh Yogamat-kz-архив.sh "/путь/к/папке"
    #   3. Рядом появится «Yogamat-kz-2026-11-17.zip» — его можно отправить или сохранить.
    #
    # Без аргумента скрипт берёт папку, в которой лежит сам.

    set -e

    folder="${1:-${0:A:h}}"
    folder="${folder%/}"

    if [[ ! -d "$folder" ]]; then
      echo "Папка не найдена: $folder"
      exit 1
    fi

    name="Yogamat-kz-2026-11-17.zip"
    target="${folder:h}/${name}"

    rm -f "$target"

    cd "${folder:h}"
    zip -r -q "$target" "${folder:t}" -x "*/DerivedData/*" -x "*/.git/*" -x "*/build/*" -x "*.DS_Store"

    echo "Готово: $target"
    du -h "$target" | awk '{print "Размер: " $1}'

    """

    /// Файл скрипта во временной папке — для системного окна обмена.
    static func scriptURL() -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(scriptName)
        try? FileManager.default.removeItem(at: url)
        do {
            try script.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }
}
