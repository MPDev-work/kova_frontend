import { useMemo } from 'react';
import {
  getCommunes,
  getDistricts,
  getProvinces,
} from '@sothikhorn/cambodia-gazetteer';

interface CambodiaLocationSelectorProps {
  province: string;
  district: string;
  commune: string;
  onChange: (next: {
    province: string;
    district: string;
    commune: string;
  }) => void;
  required?: boolean;
  inputClassName?: string;
  labelClassName?: string;
}

const ALL_PROVINCES = getProvinces().sort((a, b) => {
  if (a.en_name === 'Phnom Penh') return -1;
  if (b.en_name === 'Phnom Penh') return 1;
  return a.en_name.localeCompare(b.en_name);
});

/**
 * Cascading Cambodia administrative division selector powered by official NCDD Gazetteer data:
 * 25 Provinces -> 210 Districts/Khans -> 1,652 Communes/Sangkats.
 */
export function CambodiaLocationSelector({
  province,
  district,
  commune,
  onChange,
  required = true,
  inputClassName = 'border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none',
  labelClassName = 'text-[12px] font-semibold text-black',
}: CambodiaLocationSelectorProps) {
  const selectedProvinceObj = useMemo(
    () =>
      ALL_PROVINCES.find(
        (p) => p.en_name.toLowerCase() === province.toLowerCase(),
      ) || ALL_PROVINCES[0],
    [province],
  );

  const districts = useMemo(
    () =>
      selectedProvinceObj
        ? getDistricts(selectedProvinceObj.code).sort((a, b) =>
            a.en_name.localeCompare(b.en_name),
          )
        : [],
    [selectedProvinceObj],
  );

  const selectedDistrictObj = useMemo(
    () =>
      districts.find(
        (d) => d.en_name.toLowerCase() === district.toLowerCase(),
      ) || null,
    [districts, district],
  );

  const communes = useMemo(
    () =>
      selectedDistrictObj
        ? getCommunes(selectedDistrictObj.code).sort((a, b) =>
            a.en_name.localeCompare(b.en_name),
          )
        : [],
    [selectedDistrictObj],
  );

  const handleProvinceChange = (nextProvinceName: string) => {
    const provObj = ALL_PROVINCES.find((p) => p.en_name === nextProvinceName);
    const nextDistricts = provObj
      ? getDistricts(provObj.code).sort((a, b) =>
          a.en_name.localeCompare(b.en_name),
        )
      : [];
    const firstDistrict = nextDistricts[0];
    const nextCommunes = firstDistrict
      ? getCommunes(firstDistrict.code).sort((a, b) =>
          a.en_name.localeCompare(b.en_name),
        )
      : [];
    onChange({
      province: nextProvinceName,
      district: firstDistrict?.en_name || '',
      commune: nextCommunes[0]?.en_name || '',
    });
  };

  const handleDistrictChange = (nextDistrictName: string) => {
    const distObj = districts.find((d) => d.en_name === nextDistrictName);
    const nextCommunes = distObj
      ? getCommunes(distObj.code).sort((a, b) =>
          a.en_name.localeCompare(b.en_name),
        )
      : [];
    onChange({
      province: selectedProvinceObj?.en_name || province,
      district: nextDistrictName,
      commune: nextCommunes[0]?.en_name || '',
    });
  };

  const handleCommuneChange = (nextCommuneName: string) => {
    onChange({
      province: selectedProvinceObj?.en_name || province,
      district: selectedDistrictObj?.en_name || district,
      commune: nextCommuneName,
    });
  };

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className={labelClassName}>Province / City</span>
        <select
          required={required}
          value={selectedProvinceObj?.en_name || ''}
          onChange={(e) => handleProvinceChange(e.target.value)}
          className={inputClassName}
        >
          {ALL_PROVINCES.map((p) => (
            <option key={p.code} value={p.en_name}>
              {p.en_name} ({p.name})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClassName}>District / Khan</span>
        <select
          required={required}
          value={selectedDistrictObj?.en_name || ''}
          onChange={(e) => handleDistrictChange(e.target.value)}
          className={inputClassName}
        >
          <option value="" disabled>
            Select district / khan
          </option>
          {districts.map((d) => (
            <option key={d.code} value={d.en_name}>
              {d.en_name} ({d.name})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClassName}>Commune / Sangkat</span>
        <select
          required={required}
          value={
            communes.some((c) => c.en_name === commune) ? commune : ''
          }
          onChange={(e) => handleCommuneChange(e.target.value)}
          disabled={communes.length === 0}
          className={`${inputClassName} disabled:bg-[#f7f7f7] disabled:text-[#979797]`}
        >
          <option value="" disabled>
            {communes.length === 0
              ? 'Select district first'
              : 'Select commune / sangkat'}
          </option>
          {communes.map((c) => (
            <option key={c.code} value={c.en_name}>
              {c.en_name} ({c.name})
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
