"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, XAxis, YAxis, Bar, Tooltip, Legend, ReferenceLine } from 'recharts';
import Image from 'next/image';

// Update this path/name if your logo file is different
import blueWhaleLogo from './icon.png';

// Function to format currency with commas and two decimal places
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const EnergyModelingApp: React.FC = () => {
  // Data from the spreadsheet
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxDemands = [3114, 2736, 1467, 3894, 3085, 3077, 3113, 3098]; // kW

  // State variables
  const [batteryCapacity, setBatteryCapacity] = useState(400);  // Default: 400 kW
  const [contractedCapacity, setContractedCapacity] = useState(3100); // Default: 3,100 kW
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate effective demands after battery peak shaving
  const effectiveDemands = maxDemands.map((demand) => Math.max(0, demand - batteryCapacity));
  const minEffectiveDemand = Math.min(...effectiveDemands);
  const maxEffectiveDemand = Math.max(...effectiveDemands);

  // Monthly charge calculation
  const calculateMonthlyCharge = (effectiveDemand: number, capacity: number): number => {
    const contractedCharge = capacity * 16.37; // $16.37/kW/month
    const exceedance = Math.max(0, effectiveDemand - capacity);
    const uncontractedCharge = exceedance * 24.56; // $24.56/kW/month
    return contractedCharge + uncontractedCharge;
  };

  // Calculate total charge over 8 months
  const calculateTotalCharge = (capacity: number): number => {
    return effectiveDemands
      .map((effDemand) => calculateMonthlyCharge(effDemand, capacity))
      .reduce((sum, charge) => sum + charge, 0);
  };

  // Find the optimal contracted capacity by brute force
  const findOptimalCapacity = (): number => {
    let optimalCapacity = 0;
    let minCost = Infinity;
    for (let capacity = 1000; capacity <= 4000; capacity += 10) {
      const totalCost = calculateTotalCharge(capacity);
      if (totalCost < minCost) {
        minCost = totalCost;
        optimalCapacity = capacity;
      }
    }
    return optimalCapacity;
  };

  // Handle "Set Optimal Capacity"
  const handleSetOptimalCapacity = () => {
    const optimalCapacity = findOptimalCapacity();
    setContractedCapacity(optimalCapacity);
    setExplanation(
      `The optimal contracted capacity of ${optimalCapacity} kW was determined by minimizing the total cost over 8 months, ` +
      `balancing fixed charges ($16.37/kW/month) against penalties for exceeding the contracted capacity ($24.56/kW/month).`
    );
  };

  // Monthly charges with current battery & contracted capacity
  const monthlyCharges = effectiveDemands.map((effDemand) =>
    calculateMonthlyCharge(effDemand, contractedCapacity)
  );
  const totalCharge = monthlyCharges.reduce((sum, c) => sum + c, 0);

  // Original scenario (no battery, capacity = 3,100 kW)
  const originalCharges = maxDemands.map((demand) => calculateMonthlyCharge(demand, 3100));
  const totalOriginalCharge = originalCharges.reduce((sum, c) => sum + c, 0);

  // Net savings (could be negative)
  const savings = totalOriginalCharge - totalCharge;
  const isPositiveSavings = savings >= 0;
  const netLabel = isPositiveSavings ? 'savings' : 'additional cost';
  const netAmount = formatCurrency(Math.abs(savings));

  // Reason for negative scenario
  let negativeReason =
    'the contracted capacity may be set too low relative to your effective demands, causing higher exceedance penalties.';
  if (contractedCapacity > maxEffectiveDemand) {
    negativeReason =
      'the contracted capacity may be set too high relative to your actual usage, causing overpayment in fixed charges.';
  } else if (contractedCapacity < minEffectiveDemand) {
    negativeReason =
      'the contracted capacity may be set too low relative to your effective demands, causing higher exceedance penalties.';
  }

  // Monthly savings
  const monthlySavings = maxDemands.map((demand, index) => {
    const originalCharge = calculateMonthlyCharge(demand, 3100);
    const newCharge = monthlyCharges[index];
    return originalCharge - newCharge;
  });

  // Chart data
  const chartData = months.map((month, index) => ({
    month,
    maxDemand: maxDemands[index],
    effectiveDemand: effectiveDemands[index],
  }));

  // Dragging event for reference line
  useEffect(() => {
    if (!chartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && chartRef.current) {
        const chartRect = chartRef.current.getBoundingClientRect();
        const chartHeight = chartRect.height;
        const yPixel = e.clientY - chartRect.top;
        if (yPixel >= 0 && yPixel <= chartHeight) {
          const yValue = (1 - yPixel / chartHeight) * 4000;
          const newCapacity = Math.round(yValue / 10) * 10;
          setContractedCapacity(Math.max(1000, Math.min(4000, newCapacity)));
        }
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    const chartElement = chartRef.current;
    chartElement.addEventListener('mousemove', handleMouseMove);
    chartElement.addEventListener('mouseup', handleMouseUp);
    chartElement.addEventListener('mouseleave', handleMouseUp);

    return () => {
      chartElement.removeEventListener('mousemove', handleMouseMove);
      chartElement.removeEventListener('mouseup', handleMouseUp);
      chartElement.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDragging]);

  // Responsive chart width
  const containerWidth = chartRef.current ? chartRef.current.offsetWidth * 0.9 : 700;

  return (
    <div className="p-0 m-0">
      {/* --- SIMPLE MINIMAL HEADER --- */}
      <header className="flex items-center p-4 border-b border-gray-200 bg-white">
        <Image
          src={blueWhaleLogo}
          alt="Blue Whale Energy Logo"
          width={40}
          height={40}
          priority
        />
        <span className="ml-3 text-xl font-bold text-gray-800">
          Blue Whale Energy
        </span>
      </header>

      <main className="p-6 font-sans max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Capacity Charge Modeling - ITE College West
        </h1>

        {/* Inputs */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Battery Capacity (kW)
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              step={10}
              value={batteryCapacity}
              onChange={(e) => setBatteryCapacity(Number(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Contracted Capacity (kW)
            </label>
            <input
              type="number"
              min={1000}
              max={4000}
              step={10}
              value={contractedCapacity}
              onChange={(e) => setContractedCapacity(Number(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSetOptimalCapacity}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Set Optimal Capacity
            </button>
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-md whitespace-pre-line">
            <p>{explanation}</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-md shadow-sm">
            <p className="text-sm font-medium text-gray-500">Contracted Capacity</p>
            <p className="text-2xl font-bold text-gray-800">{contractedCapacity} kW</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-md shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Charge (8 months)</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(totalCharge)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-md shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Savings vs Original (8 months)
            </p>
            <p className={`text-2xl font-bold ${isPositiveSavings ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(savings)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div
          ref={chartRef}
          className="mb-6 bg-white p-4 rounded-md shadow-sm cursor-grab relative"
          onMouseDown={() => setIsDragging(true)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {isClient ? (
            <ComposedChart width={containerWidth} height={400} data={chartData}>
              <XAxis dataKey="month" />
              <YAxis domain={[0, 4000]} label={{ value: 'Demand (kW)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => value.toFixed(0)} />
              <Legend />
              <Bar dataKey="maxDemand" fill="#f87171" name="Max Demand" />
              <Bar dataKey="effectiveDemand" fill="#4ade80" name="Effective Demand (after battery)" />
              <ReferenceLine
                y={contractedCapacity}
                stroke="#3b82f6"
                strokeWidth={isHovering || isDragging ? 3 : 2}
                className={`${isDragging ? 'shadow-md' : ''} transition-all duration-200 ease-in-out`}
              />
            </ComposedChart>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p>Loading chart...</p>
            </div>
          )}
          {isHovering && isClient && (
            <div className="absolute top-4 left-4 bg-gray-800 text-white p-2 rounded-md shadow-md pointer-events-none">
              Contracted Capacity: {contractedCapacity} kW
            </div>
          )}
        </div>

        {/* Monthly Breakdown Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full bg-white border border-gray-200 rounded-md shadow-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                <th className="py-3 px-4 text-left">Month</th>
                <th className="py-3 px-4 text-right">Max Demand (kW)</th>
                <th className="py-3 px-4 text-right">Effective Demand (kW)</th>
                <th className="py-3 px-4 text-right">Exceedance (kW)</th>
                <th className="py-3 px-4 text-right">Total Charge ($)</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {months.map((month, index) => {
                const effectiveDemand = effectiveDemands[index];
                const exceedance = Math.max(0, effectiveDemand - contractedCapacity);
                const monthlyCharge = monthlyCharges[index];
                return (
                  <tr key={month} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-left">{month}</td>
                    <td className="py-3 px-4 text-right">{maxDemands[index]}</td>
                    <td className="py-3 px-4 text-right">{effectiveDemand.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right">{exceedance.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(monthlyCharge)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Monthly Savings & Optimization Rationale */}
        <div className="p-4 bg-white border border-gray-200 rounded-md shadow-sm mb-6">
          <h3 className="font-bold mb-2 text-gray-800">Monthly Savings & Optimization Rationale</h3>
          <p className="text-sm text-gray-500 mb-3">
            With a contracted capacity of <strong>{contractedCapacity} kW</strong>, your monthly demand charges are
            {isPositiveSavings ? ' lowered' : ' higher'} compared to the original 3,100 kW scenario, as shown in the table below. 
            This {isPositiveSavings ? 'saves' : 'costs'} you overall because{' '}
            {isPositiveSavings
              ? 'the battery helps reduce your peak demand each month, thus reducing penalties for exceedance.'
              : negativeReason
            }
          </p>

          {/* Table for monthly net impact (savings or cost) */}
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full bg-white border border-gray-200 rounded-md shadow-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <th className="py-3 px-4 text-left">Month</th>
                  <th className="py-3 px-4 text-right">Monthly Net Impact ($)</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {months.map((month, index) => {
                  const saving = monthlySavings[index];
                  const savingColor = saving >= 0 ? 'text-green-600' : 'text-red-600';
                  return (
                    <tr key={month} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-left">{month}</td>
                      <td className={`py-3 px-4 text-right ${savingColor}`}>
                        {formatCurrency(saving)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-gray-500">
            Overall, this yields a total <strong>{netLabel}</strong> of{' '}
            <strong className={isPositiveSavings ? 'text-green-600' : 'text-red-600'}>
              {netAmount}
            </strong>{' '}
            over 8 months. The model determines the <em>optimal contracted capacity</em> by finding the best balance
            between the fixed charge (<code>$16.37/kW/month</code>) and potential exceedance charges (<code>$24.56/kW/month</code>)
            when your effective demand goes above the contracted limit.
          </p>
        </div>

        {/* Assumptions & Limitations and How It Works */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Assumptions & Limitations Card */}
          <div className="p-4 bg-white border border-gray-200 rounded-md shadow-sm">
            <h3 className="font-bold mb-2 text-gray-800">Assumptions & Limitations</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-500">
              <li>The battery reduces maximum demand each month through peak shaving, assuming full availability and perfect prediction of peak usage.</li>
              <li>Charges are based on a contracted capacity rate of $16.37 per kW per month and an uncontracted rate of $24.56 per kW of exceedance per month, as provided for ITE College West under the Geneco - High Tension tariff.</li>
              <li>The original scenario assumes no battery usage and a fixed contracted capacity of 3,100 kW, reflecting historical data from May to December 2024.</li>
              <li>This model simplifies real-world billing by excluding peak/off-peak energy charges, reactive power charges, and other potential fees or constraints (e.g., battery recharge times, grid constraints, or demand response schedules).</li>
              <li>Results may vary based on actual operational conditions, battery efficiency, and utility policies not detailed in the provided data.</li>
            </ul>
          </div>

          {/* How It Works Card */}
          <div className="p-4 bg-white border border-gray-200 rounded-md shadow-sm">
            <h3 className="font-bold mb-2 text-gray-800">How It Works</h3>
            <div className="text-sm text-gray-500">
              <p className="mb-2">
                This tool solves for the optimal contracted capacity by analyzing your historical maximum demand data (May to December 2024) 
                and accounting for a battery that reduces peak demand by up to its capacity (e.g., 400 kW by default). Here's the process:
              </p>
              <ul className="list-disc list-inside mt-2">
                <li>
                  We calculate the effective demand after battery peak shaving using:{' '}
                  <code>Effective Demand = Max(0, Max Demand - Battery Capacity)</code>.
                </li>
                <li>
                  We then compute monthly charges using:{' '}
                  <code>Total Monthly Charge = (Contracted Capacity × $16.37) + Max(0, Effective Demand - Contracted Capacity) × $24.56</code>.
                </li>
                <li>
                  To find the optimal capacity, we test a range of contracted capacities (1,000 to 4,000 kW in 10 kW increments) 
                  and sum the total cost over 8 months, selecting the capacity that minimizes this total cost.
                </li>
                <li>
                  You can adjust the battery capacity and contracted capacity interactively, or use the "Set Optimal Capacity" 
                  button to automatically find the cost-minimizing value.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EnergyModelingApp;
