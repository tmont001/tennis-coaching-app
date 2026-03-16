'use client';
// components/roster/CsvImportForm.tsx
// Lets coaches upload a CSV file to bulk-import players.

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, X } from 'lucide-react';
import { importPlayersFromCsv, type CsvPlayerRow } from '@/actions/roster';
import { Spinner } from '@/components/ui';

interface CsvImportFormProps {
  teamId: string;
  onSuccess: () => void;
}

interface ParsedRow {
  full_name: string;
  grad_year?: string;
  jersey_number?: string;
  ladder_rank?: string;
}

interface ValidationResult {
  valid: ParsedRow[];
  errors: string[];
}

export function CsvImportForm({ teamId, onSuccess }: CsvImportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  function parseCsv(text: string): ValidationResult {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) {
      return {
        valid: [],
        errors: ['CSV must have a header row and at least one data row.'],
      };
    }

    // Normalize headers
    const headers = lines[0].split(',').map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z_]/g, ''),
    );

    const nameIndex = headers.findIndex((h) =>
      ['full_name', 'name', 'player_name', 'player'].includes(h),
    );

    if (nameIndex === -1) {
      return {
        valid: [],
        errors: ['CSV must have a column named "full_name" or "name".'],
      };
    }

    const gradIndex = headers.findIndex((h) =>
      ['grad_year', 'graduation_year', 'year'].includes(h),
    );
    const jerseyIndex = headers.findIndex((h) =>
      ['jersey_number', 'jersey', 'number'].includes(h),
    );
    const rankIndex = headers.findIndex((h) =>
      ['ladder_rank', 'rank'].includes(h),
    );

    const valid: ParsedRow[] = [];
    const errors: string[] = [];

    lines.slice(1).forEach((line, i) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const name = cols[nameIndex]?.trim();
      if (!name) {
        errors.push(`Row ${i + 2}: missing name, skipped.`);
        return;
      }
      valid.push({
        full_name: name,
        grad_year: gradIndex >= 0 ? cols[gradIndex] : undefined,
        jersey_number: jerseyIndex >= 0 ? cols[jerseyIndex] : undefined,
        ladder_rank: rankIndex >= 0 ? cols[rankIndex] : undefined,
      });
    });

    return { valid, errors };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsed(null);
    setImportResult(null);
    setServerError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setParsed(parseCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setImporting(true);
    setServerError(null);

    const result = await importPlayersFromCsv(
      teamId,
      parsed.valid as CsvPlayerRow[],
    );

    setImporting(false);
    if (result.error) {
      setServerError(result.error);
      return;
    }

    setImportResult(`Successfully imported ${result.data?.imported} players.`);
    setTimeout(onSuccess, 1500);
  }

  function clearFile() {
    setParsed(null);
    setFileName(null);
    setImportResult(null);
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-700">CSV format requirements:</p>
        <ul className="space-y-1 text-xs text-gray-500 list-disc list-inside">
          <li>First row must be a header row</li>
          <li>
            <strong>Required:</strong>{' '}
            <code className="bg-gray-200 px-1 rounded">full_name</code> or{' '}
            <code className="bg-gray-200 px-1 rounded">name</code>
          </li>
          <li>
            <strong>Optional:</strong>{' '}
            <code className="bg-gray-200 px-1 rounded">grad_year</code>,{' '}
            <code className="bg-gray-200 px-1 rounded">jersey_number</code>,{' '}
            <code className="bg-gray-200 px-1 rounded">ladder_rank</code>
          </li>
          <li>Maximum 100 players per import</li>
        </ul>
        <p className="text-xs text-gray-400 font-mono bg-gray-100 p-2 rounded mt-2">
          full_name,grad_year,jersey_number,ladder_rank
          <br />
          Jane Smith,2026,4,1
          <br />
          Alex Johnson,2025,7,2
        </p>
      </div>

      {/* File upload */}
      {!fileName ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-400 hover:bg-brand-50 transition-colors"
        >
          <Upload className="mx-auto text-gray-400 mb-2" size={24} />
          <p className="text-sm font-medium text-gray-600">
            Click to upload CSV
          </p>
          <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
          <FileText size={18} className="text-brand-600 flex-shrink-0" />
          <span className="text-sm text-gray-700 flex-1 truncate">
            {fileName}
          </span>
          <button
            onClick={clearFile}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Parse preview */}
      {parsed && (
        <div className="space-y-2">
          {parsed.valid.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle size={15} />
              {parsed.valid.length} player{parsed.valid.length !== 1 ? 's' : ''}{' '}
              ready to import
            </div>
          )}
          {parsed.errors.length > 0 && (
            <div className="space-y-1">
              {parsed.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                >
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          {parsed.valid.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">
                      Name
                    </th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">
                      Year
                    </th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">
                      Rank
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.valid.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-700">
                        {row.full_name}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {row.grad_year || '—'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {row.ladder_rank || '—'}
                      </td>
                    </tr>
                  ))}
                  {parsed.valid.length > 20 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-1.5 text-gray-400 text-center"
                      >
                        +{parsed.valid.length - 20} more…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {importResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={15} />
          {importResult}
        </div>
      )}

      {serverError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {serverError}
        </div>
      )}

      {/* Import button */}
      {parsed && parsed.valid.length > 0 && !importResult && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-primary w-full"
        >
          {importing ? (
            <>
              <Spinner className="w-4 h-4" />
              Importing…
            </>
          ) : (
            `Import ${parsed.valid.length} player${parsed.valid.length !== 1 ? 's' : ''}`
          )}
        </button>
      )}
    </div>
  );
}
