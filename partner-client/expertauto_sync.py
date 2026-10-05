#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ExpertAuto SAS - Connecteur d'expertises MutuAlp / SinistreFlow
=================================================================
Contrat d'interconnexion n° EA-MA-2023-07 - Version du connecteur : 2.6.1

CE PROGRAMME APPARTIENT A EXPERTAUTO SAS. IL N'EST PAS MODIFIABLE PAR MUTUALP.
Toute évolution passe par une demande de changement auprès de la DSI ExpertAuto
(délai contractuel : 6 mois).

Fonctionnement (exécuté toutes les heures sur le serveur de MutuAlp) :
  1. vérifie que SinistreFlow est disponible ;
  2. récupère les dossiers en attente d'expertise (API v1) ;
  3. lit le détail du dossier à expertiser (API v2) ;
  4. dépose le rapport d'expertise (API v2) ;
  5. contrôle le dossier mis à jour (API v3 + v1).

Configuration (variables d'environnement) :
  SINISTREFLOW_URL      URL de SinistreFlow (défaut : http://localhost:3000)
  EXPERTAUTO_API_KEY    clé API fournie par MutuAlp

Code retour : 0 si la synchronisation est conforme, 1 sinon.
Python 3.8+ - aucune dépendance externe.
"""
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.request

VERSION = "2.6.1"
BASE_URL = os.environ.get("SINISTREFLOW_URL", "http://localhost:3000").rstrip("/")
API_KEY = os.environ.get("EXPERTAUTO_API_KEY", "")
TIMEOUT = 10

PLATE = re.compile(r"^[A-Z]{2}-\d{3}-[A-Z]{2}$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
AUTO_TYPES = {"AUTO_COLLISION", "AUTO_VOL", "BRIS_DE_GLACE"}

USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
GREEN, RED, YELLOW, BOLD, DIM, RESET = (
    ("\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[2m", "\033[0m") if USE_COLOR else ("",) * 6
)


class Report:
    def __init__(self):
        self.results = []

    def check(self, label, ok, detail=""):
        self.results.append({"check": label, "ok": bool(ok), "detail": detail})
        mark = f"{GREEN}OK  {RESET}" if ok else f"{RED}KO  {RESET}"
        print(f"   {mark} {label}" + (f" {DIM}({detail}){RESET}" if detail and not ok else ""))
        return bool(ok)

    @property
    def failed(self):
        return [r for r in self.results if not r["ok"]]


def call(method, path, body=None):
    """Appel HTTP JSON. Retourne (code, corps décodé ou texte, en-têtes)."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE_URL + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", f"ExpertAuto-Connector/{VERSION}")
    req.add_header("X-API-Key", API_KEY)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            status, headers = resp.status, dict(resp.headers)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        status, headers = err.code, dict(err.headers)
    except (urllib.error.URLError, OSError) as err:
        return 0, f"connexion impossible : {getattr(err, 'reason', err)}", {}
    try:
        return status, json.loads(raw), headers
    except ValueError:
        return status, raw, headers


def short(payload):
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return text[:160] + ("..." if len(text) > 160 else "")


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def step(title):
    print(f"\n{BOLD}{title}{RESET}")


def main():
    print(f"{BOLD}ExpertAuto - connecteur SinistreFlow v{VERSION}{RESET}")
    print(f"{DIM}Cible : {BASE_URL}  |  {datetime.datetime.now():%d/%m/%Y %H:%M:%S}{RESET}")
    report = Report()

    if not API_KEY:
        report.check("Clé API configurée (EXPERTAUTO_API_KEY)", False, "variable absente")
        return finish(report)

    # 1. disponibilité -----------------------------------------------------------
    step("[1/5] Disponibilité de SinistreFlow")
    status, body, _ = call("GET", "/health")
    if not report.check("GET /health répond 200", status == 200, f"HTTP {status} {short(body)}"):
        return finish(report)
    report.check("statut applicatif UP", isinstance(body, dict) and body.get("status") == "UP", short(body))

    # 2. dossiers à expertiser (v1) ----------------------------------------------
    step("[2/5] Dossiers en attente d'expertise (API v1)")
    status, body, _ = call("GET", "/api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=50")
    if not report.check("GET /api/v1/claims répond 200", status == 200, f"HTTP {status} {short(body)}"):
        return finish(report)
    items = body.get("data", []) if isinstance(body, dict) else []
    if not report.check("au moins un dossier en attente d'expertise", len(items) > 0,
                        f"{len(items)} dossier(s) reçu(s), total annoncé : {body.get('total')}"):
        return finish(report)
    report.check("champs v1 présents (reference, numero_contrat, date_sinistre, statut, immatriculation)",
                 all(all(k in it for k in ("reference", "numero_contrat", "date_sinistre", "statut", "immatriculation"))
                     for it in items), short(items[0]))
    report.check("statut des dossiers = EXPERTISE_EN_COURS",
                 all(it.get("statut") == "EXPERTISE_EN_COURS" for it in items))
    auto_items = [it for it in items if it.get("type_sinistre") in AUTO_TYPES]
    missing = [it.get("reference") for it in auto_items if not it.get("immatriculation")]
    report.check("immatriculation renseignée sur les dossiers auto", not missing,
                 f"{len(missing)} dossier(s) sans immatriculation : {', '.join(missing[:4])}")
    if not auto_items:
        report.check("au moins un dossier AUTO à expertiser", False, "aucun dossier auto dans la liste")
        return finish(report)
    target = auto_items[0]
    ref = target["reference"]
    print(f"   {DIM}-> dossier traité : {ref}{RESET}")

    # 3. détail du dossier (v2) --------------------------------------------------
    step(f"[3/5] Détail du dossier {ref} (API v2)")
    status, claim, _ = call("GET", f"/api/v2/claims/{ref}")
    if not report.check("GET /api/v2/claims/{ref} répond 200", status == 200, f"HTTP {status} {short(claim)}"):
        return finish(report)
    plate = claim.get("vehiclePlate")
    report.check("vehiclePlate au format AA-123-AA", isinstance(plate, str) and PLATE.match(plate) is not None,
                 f"vehiclePlate={plate!r}")
    estimated = claim.get("estimatedAmountCents")
    report.check("estimatedAmountCents est un entier", is_int(estimated),
                 f"type reçu : {type(estimated).__name__} ({estimated!r})")
    report.check("incidentDate au format AAAA-MM-JJ", isinstance(claim.get("incidentDate"), str)
                 and ISO_DATE.match(claim["incidentDate"]) is not None, repr(claim.get("incidentDate")))
    report.check("incidentDate v2 = date_sinistre v1", claim.get("incidentDate") == target.get("date_sinistre"),
                 f"v2={claim.get('incidentDate')} v1={target.get('date_sinistre')}")

    # 4. dépôt du rapport (v2) ---------------------------------------------------
    step(f"[4/5] Dépôt du rapport d'expertise (API v2)")
    try:
        assessed = int(int(estimated) * 0.9)
    except (TypeError, ValueError):
        assessed = 100000
    appointment = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
    payload = {
        "expertName": "Cabinet ExpertAuto - J. Morel",
        "appointmentDate": appointment,
        "assessedAmountCents": assessed,
        "conclusion": "Dommages conformes à la déclaration. Réparation économiquement justifiée.",
    }
    status, after, _ = call("POST", f"/api/v2/claims/{ref}/expertise", payload)
    if not report.check("POST /api/v2/claims/{ref}/expertise répond 201", status == 201,
                        f"HTTP {status} {short(after)}"):
        return finish(report)
    report.check("statut v2 = EXPERTISE_TERMINEE", after.get("status") == "EXPERTISE_TERMINEE", repr(after.get("status")))
    report.check("indemnityCents est un entier", is_int(after.get("indemnityCents")),
                 f"type reçu : {type(after.get('indemnityCents')).__name__}")

    # 5. contrôle croisé (v3 + v1) -----------------------------------------------
    step(f"[5/5] Contrôle du dossier mis à jour (API v3 + v1)")
    status, v3, _ = call("GET", f"/api/v3/claims/{ref}")
    if report.check("GET /api/v3/claims/{ref} répond 200", status == 200, f"HTTP {status} {short(v3)}"):
        amounts = v3.get("amounts") or {}
        deductible = (v3.get("contract") or {}).get("deductibleCents")
        expected = max(0, assessed - deductible) if is_int(deductible) else None
        report.check("statut v3 = ASSESSMENT_DONE", v3.get("status") == "ASSESSMENT_DONE", repr(v3.get("status")))
        report.check("montant expertisé enregistré", amounts.get("assessedCents") == assessed,
                     f"attendu {assessed}, reçu {amounts.get('assessedCents')!r}")
        report.check("indemnité = expertise - franchise (plancher 0)", amounts.get("indemnityCents") == expected,
                     f"attendu {expected}, reçu {amounts.get('indemnityCents')!r} (franchise {deductible!r})")
        report.check("date de rendez-vous enregistrée telle qu'envoyée",
                     (v3.get("expertise") or {}).get("appointmentDate") == appointment,
                     f"envoyée {appointment}, relue {(v3.get('expertise') or {}).get('appointmentDate')!r}")
        report.check("immatriculation identique en v2 et v3", (v3.get("vehicle") or {}).get("plate") == plate,
                     f"v2={plate!r} v3={(v3.get('vehicle') or {}).get('plate')!r}")
        report.check("date du sinistre identique en v2 et v3",
                     (v3.get("incident") or {}).get("date") == claim.get("incidentDate"),
                     f"v2={claim.get('incidentDate')} v3={(v3.get('incident') or {}).get('date')}")

    status, v1, _ = call("GET", f"/api/v1/claims/{ref}")
    if report.check("GET /api/v1/claims/{ref} répond 200", status == 200, f"HTTP {status} {short(v1)}"):
        report.check("statut v1 = EXPERTISE_TERMINEE", v1.get("statut") == "EXPERTISE_TERMINEE", repr(v1.get("statut")))
        report.check("immatriculation v1 = v2", v1.get("immatriculation") == plate,
                     f"v1={v1.get('immatriculation')!r} v2={plate!r}")

    return finish(report)


def finish(report):
    total, failed = len(report.results), report.failed
    print()
    if failed:
        print(f"{RED}{BOLD}SYNCHRONISATION NON CONFORME : {len(failed)} contrôle(s) en échec sur {total}{RESET}")
        print(f"{DIM}Merci de contacter le support MutuAlp avant toute nouvelle tentative.{RESET}")
    else:
        print(f"{GREEN}{BOLD}SYNCHRONISATION CONFORME : {total}/{total} contrôles OK{RESET}")
    report_path = os.environ.get("EXPERTAUTO_REPORT")
    if report_path:
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump({"version": VERSION, "target": BASE_URL, "date": datetime.datetime.now().isoformat(),
                       "ok": not failed, "results": report.results}, fh, ensure_ascii=False, indent=2)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
