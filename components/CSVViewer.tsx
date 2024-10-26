'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { parse, unparse } from 'papaparse';
import { Edit2, Save, X } from 'lucide-react';

const CSVViewer = () => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [filters, setFilters] = useState({});
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [uniqueDates, setUniqueDates] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [allTechnicians, setAllTechnicians] = useState([]);
  const [newTechnician, setNewTechnician] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropZoneActive, setDropZoneActive] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F7') {
        setIsFiltering(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // Fonction pour comparer les dates
  const isSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getOperationId = (task) => {
    return `${task[0]}_${task[1]}_${task[2]}_${task[4]}`;
  };

  const handleEditClick = (row) => {
    const operationId = getOperationId(row);
    setEditingRow(operationId);
    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index];
    });
    setEditedData(rowData);
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };

  const handleSaveEdit = (operationId) => {
    const updatedRow = headers.map(header => editedData[header] || '');
    setData(prevData => prevData.map(row => 
      getOperationId(row) === operationId ? updatedRow : row
    ));
    setEditingRow(null);
    setEditedData({});
  };

  const handleInputChange = (header, value) => {
    setEditedData(prev => ({
      ...prev,
      [header]: value
    }));
  };

  const renderCell = (row, cell, header, index) => {
    const operationId = getOperationId(row);
    const isEditing = editingRow === operationId;

    if (isEditing) {
      if (header.toLowerCase().includes('date')) {
        return (
          <input
            type="date"
            value={editedData[header] || ''}
            onChange={(e) => handleInputChange(header, e.target.value)}
            className="w-full p-1 border rounded"
          />
        );
      }
      return (
        <input
          type="text"
          value={editedData[header] || ''}
          onChange={(e) => handleInputChange(header, e.target.value)}
          className="w-full p-1 border rounded"
        />
      );
    }
    return cell || '';
  };

  const getUniqueColor = (index) => {
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const detectOverlaps = (tasks) => {
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.startPercentage === b.startPercentage) {
        return (b.startPercentage + b.duration) - (a.startPercentage + a.duration);
      }
      return a.startPercentage - b.startPercentage;
    });

    const overlaps = new Map();
    const timeSlots = new Map();

    for (let i = 0; i < sortedTasks.length; i++) {
      const currentTask = sortedTasks[i];
      const currentId = getOperationId(currentTask.task);
      const start = currentTask.startPercentage;
      const end = start + currentTask.duration;

      let level = 0;
      let foundSlot = false;

      while (!foundSlot) {
        foundSlot = true;
        for (let time = Math.floor(start); time <= Math.ceil(end); time += 1) {
          const timeKey = `${level}_${time}`;
          if (timeSlots.has(timeKey)) {
            foundSlot = false;
            level++;
            break;
          }
        }
      }

      for (let time = Math.floor(start); time <= Math.ceil(end); time += 1) {
        timeSlots.set(`${level}_${time}`, currentId);
      }

      overlaps.set(currentId, level);
    }

    return overlaps;
  };

  const getDatesRange = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  const getTimePercentage = (time) => {
    if (!time) return 0;
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return 0;
      return ((hours * 60 + minutes) / (24 * 60)) * 100;
    } catch (err) {
      console.error('Erreur lors du calcul du pourcentage de temps:', err);
      return 0;
    }
  };

  const groupDataByType = useCallback((groupBy, filteredDataForDate) => {
    let groupIndex, labelIndex;
    let groups = [];

    switch (groupBy) {
      case 'Véhicule':
        groupIndex = 0;
        labelIndex = 1;
        groups = [...new Set(filteredDataForDate.map(row => row[groupIndex]))]
          .filter(Boolean)
          .sort();
        break;
      case 'Lieu':
        groupIndex = 10;
        labelIndex = 1;
        groups = [...new Set(filteredDataForDate.map(row => row[groupIndex]))]
          .filter(Boolean)
          .sort();
        break;
      case 'Technicien':
        groupIndex = 15;
        labelIndex = 15;
        groups = allTechnicians;
        break;
      default:
        return { groups: [], groupIndex: 0, labelIndex: 0 };
    }

    return { groups, groupIndex, labelIndex };
  }, [allTechnicians]);
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    parse(file, {
      complete: (results) => {
        const processedData = results.data.slice(1)
          .filter(row => row.some(cell => cell))
          .map(row => {
            const updatedRow = [...row];
            updatedRow[15] = updatedRow[15]?.trim() || "Sans technicien";

            if (updatedRow[2] && updatedRow[4]) {
              const startDate = new Date(updatedRow[2]);
              const endDate = new Date(updatedRow[4]);
              updatedRow[2] = startDate.toISOString().split('T')[0];
              updatedRow[4] = endDate.toISOString().split('T')[0];
            }
            return updatedRow;
          });

        setData(processedData);
        setHeaders(results.data[0]);

        const allDates = new Set();
        const technicianSet = new Set();

        processedData.forEach(row => {
          if (row[2] && row[4]) {
            const startDate = new Date(row[2]);
            const endDate = new Date(row[4]);

            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
              allDates.add(date.toISOString().split('T')[0]);
            }
          }
          if (row[15]) {
            technicianSet.add(row[15].trim());
          }
        });

        const sortedDates = Array.from(allDates)
          .filter(date => date)
          .sort((a, b) => new Date(a) - new Date(b));

        const sortedTechnicians = Array.from(technicianSet)
          .filter(tech => tech && tech !== "Sans technicien")
          .sort((a, b) => a.localeCompare(b));

        if (technicianSet.has("Sans technicien")) {
          sortedTechnicians.push("Sans technicien");
        }

        setUniqueDates(sortedDates);
        setAllTechnicians(sortedTechnicians);

        const initialFilters = {};
        results.data[0].forEach(header => {
          initialFilters[header] = '';
        });
        setFilters(initialFilters);
      },
      error: (error) => {
        console.error('Erreur lors de la lecture du fichier:', error);
      }
    });
  };

  const handleExportCSV = () => {
    const dataToExport = isFiltering ? filteredData : data;
    const csv = unparse({
      fields: headers,
      data: dataToExport
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, 'export.csv');
    } else {
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute('download', `export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleFilterChange = (header, value) => {
    setFilters(prev => ({
      ...prev,
      [header]: value
    }));
  };

  const handleAddTechnician = () => {
    const trimmedTechnician = newTechnician.trim();
    if (trimmedTechnician && trimmedTechnician.toLowerCase() !== 'sans technicien') {
      setAllTechnicians(prev => {
        if (prev.includes(trimmedTechnician)) {
          return prev;
        }
        const technicians = prev.filter(tech => tech !== "Sans technicien");
        technicians.push(trimmedTechnician);
        technicians.sort((a, b) => a.localeCompare(b));
        if (prev.includes("Sans technicien")) {
          technicians.push("Sans technicien");
        }
        return technicians;
      });
      setNewTechnician('');
    }
  };

  const filteredData = data.filter(row => {
    return headers.every((header, index) => {
      const filterValue = (filters[header] || '').toLowerCase();
      const cellValue = (row[index] || '').toString().toLowerCase();
      return !filterValue || cellValue.includes(filterValue);
    });
  });

  const filterDataForDate = useCallback((dateStr) => {
    if (!dateStr || !data.length) return [];

    try {
      const dateObj = new Date(dateStr);
      dateObj.setHours(0, 0, 0, 0);

      return data
        .filter(row => {
          if (!row[2] || !row[4]) return false;

          try {
            const startDate = new Date(row[2]);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(row[4]);
            endDate.setHours(23, 59, 59, 999);
            return startDate <= dateObj && dateObj <= endDate;
          } catch (err) {
            console.error('Erreur lors du filtrage des dates:', err);
            return false;
          }
        })
        .map(row => {
          const adjustedRow = [...row];
          const startDate = new Date(adjustedRow[2]);
          const endDate = new Date(adjustedRow[4]);
          const currentDate = new Date(dateStr);

          if (startDate < currentDate && !isSameDay(startDate, currentDate)) {
            adjustedRow[3] = '00:00';
          }
          if (endDate > currentDate && !isSameDay(endDate, currentDate)) {
            adjustedRow[5] = '23:59';
          }

          return adjustedRow;
        });
    } catch (err) {
      console.error('Erreur lors du filtrage des données:', err);
      return [];
    }
  }, [data]);
  const updateAssignment = useCallback((operationId, newTechnician) => {
    setData(prevData => {
      return prevData.map(row => {
        if (getOperationId(row) === operationId) {
          const newRow = [...row];
          newRow[15] = newTechnician;
          return newRow;
        }
        return row;
      });
    });
  }, []);

  const handleDragStart = (e, task) => {
    e.stopPropagation();
    const taskData = {
      ...task,
      date: selectedDate,
      operationId: getOperationId(task.task),
      startDate: task.task[2],
      endDate: task.task[4],
      originalTechnician: task.task[15]
    };

    setDraggedTask(taskData);

    const ghostElement = document.createElement('div');
    ghostElement.style.width = '100px';
    ghostElement.style.height = '30px';
    ghostElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = '-1000px';
    document.body.appendChild(ghostElement);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(ghostElement, 50, 15);

    setTimeout(() => document.body.removeChild(ghostElement), 0);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, technicianId) => {
    e.preventDefault();
    e.stopPropagation();
    setDropZoneActive(technicianId);
  }, []);

  const handleDragLeave = useCallback((e, technicianId) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneActive === technicianId) {
      setDropZoneActive(null);
    }
  }, [dropZoneActive]);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDropZoneActive(null);
  }, []);

  const handleDrop = useCallback((newTechnician, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || !draggedTask.operationId) return;

    const { operationId, startDate, endDate, originalTechnician } = draggedTask;
    const selectedDateObj = new Date(selectedDate);
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (selectedDateObj < startDateObj || selectedDateObj > endDateObj) {
      console.log("Impossible de déplacer une tâche en dehors de sa période");
      setDropZoneActive(null);
      setDraggedTask(null);
      return;
    }

    if (originalTechnician === newTechnician) {
      setDropZoneActive(null);
      return;
    }

    updateAssignment(operationId, newTechnician);
    setDropZoneActive(null);
    setDraggedTask(null);
  }, [draggedTask, selectedDate, updateAssignment]);

  const renderTimeHeader = (HEADER_HEIGHT) => (
    <div style={{ 
      height: `${HEADER_HEIGHT}px`, 
      borderBottom: '2px solid #333', 
      backgroundColor: '#f0f0f0', 
      position: 'relative'
    }}>
      {[...Array(24)].map((_, index) => (
        <div key={index} style={{ 
          position: 'absolute', 
          left: `${index * (100 / 24)}%`, 
          height: '100%', 
          borderLeft: '1px solid #ccc',
          width: '1px'
        }}>
          <span style={{ 
            position: 'absolute', 
            bottom: '5px', 
            left: '-15px', 
            fontSize: '12px',
            width: '30px',
            textAlign: 'center'
          }}>
            {`${index.toString().padStart(2, '0')}:00`}
          </span>
        </div>
      ))}
    </div>
  );

  const renderGanttTaskContent = (task, groupBy, labelIndex) => {
    if (!task) return null;
    if (groupBy === 'Technicien') {
      return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <span className="truncate">
            {`${task[0] || 'N/A'} - ${task[1] || 'N/A'}`}
          </span>
          {task[2] && task[4] && !isSameDay(new Date(task[2]), new Date(task[4])) && (
            <span className="flex-shrink-0 text-xs bg-blue-200 text-blue-800 px-1 rounded">
              Multi-jours
            </span>
          )}
        </div>
      );
    }
    return task[labelIndex] || 'N/A';
  };
  const renderTable = (dataToRender) => (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold">Vue Tableau</h2>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 
                   transition-colors duration-200 flex items-center gap-2"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
            />
          </svg>
          Exporter en CSV
        </button>
      </div>

      <div className="w-full overflow-y-auto">
        <table className="min-w-full border border-gray-300" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {headers.slice(0, 17).map((header, index) => (
                <th
                  key={index}
                  className="sticky top-0 bg-gray-800 text-white py-3 px-4 text-left text-xs font-medium border border-gray-600"
                >
                  <div className="flex flex-col gap-1">
                    <span className="truncate">{header}</span>
                    {isFiltering && (
                      <input
                        type="text"
                        value={filters[header] || ''}
                        onChange={(e) => handleFilterChange(header, e.target.value)}
                        placeholder={`Filtrer ${header}`}
                        className="w-full mt-1 p-1 text-sm border rounded bg-white text-gray-800"
                      />
                    )}
                  </div>
                </th>
              ))}
              <th className="sticky top-0 bg-gray-800 text-white py-3 px-4 text-left text-xs font-medium border border-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {dataToRender.map((row, rowIndex) => {
              const operationId = getOperationId(row);
              const isMultiDay = !isSameDay(new Date(row[2]), new Date(row[4]));
              const isEditing = editingRow === operationId;

              return (
                <tr
                  key={operationId}
                  className={`
                    ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'}
                    ${isEditing ? 'bg-yellow-50' : ''}
                    hover:bg-blue-50
                  `}
                >
                  {row.slice(0, 17).map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border border-gray-300 py-2 px-4 text-sm"
                    >
                      <div className="truncate">
                        {renderCell(row, cell, headers[cellIndex], cellIndex)}
                      </div>
                    </td>
                  ))}
                  <td className="border border-gray-300 py-2 px-4">
                    <div className="flex justify-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(operationId)}
                            className="bg-green-500 text-white p-1 rounded hover:bg-green-600"
                            title="Enregistrer"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-red-500 text-white p-1 rounded hover:bg-red-600"
                            title="Annuler"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEditClick(row)}
                          className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  const renderGanttChart = (groupBy) => {
    if (!selectedDate) {
      return <p>Veuillez sélectionner une date</p>;
    }

    const BASE_ROW_HEIGHT = 60;
    const HEADER_HEIGHT = 40;
    const TASK_HEIGHT = 20;
    const TASK_MARGIN = 4;
    const MIN_ROW_HEIGHT = BASE_ROW_HEIGHT;

    const selectedDateObj = new Date(selectedDate);
    const filteredDataForDate = filterDataForDate(selectedDate);
    const { groups = [], groupIndex = 0, labelIndex = 0 } = groupDataByType(groupBy, filteredDataForDate) || {};

    if (!groups.length) {
      return <p>Aucune donnée à afficher pour cette date</p>;
    }

    const groupedData = groups.map(group => {
      const tasks = filteredDataForDate
        .filter(row => row && row[groupIndex] === group)
        .map(task => ({
          task,
          startPercentage: getTimePercentage(task[3]),
          duration: Math.max(0.5, getTimePercentage(task[5]) - getTimePercentage(task[3])),
          operationId: getOperationId(task),
          isMultiDay: task[2] && task[4] && !isSameDay(new Date(task[2]), new Date(task[4])),
          isStart: task[2] && isSameDay(new Date(task[2]), selectedDateObj),
          isEnd: task[4] && isSameDay(new Date(task[4]), selectedDateObj)
        }));

      const overlaps = detectOverlaps(tasks);
      const maxOverlap = Math.max(0, ...Array.from(overlaps.values()));
      const rowHeight = Math.max(MIN_ROW_HEIGHT, (maxOverlap + 1) * (TASK_HEIGHT + TASK_MARGIN) + TASK_MARGIN * 2);

      return { group, tasks, overlaps, rowHeight };
    });

    return (
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', minWidth: '1000px' }}>
          {/* Colonne des groupes */}
          <div style={{ width: '200px', borderRight: '2px solid #333', backgroundColor: '#f0f0f0', flexShrink: 0, zIndex: 2, position: 'sticky', left: 0 }}>
            <div style={{ height: `${HEADER_HEIGHT}px`, borderBottom: '2px solid #333', padding: '0 10px', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
              {groupBy}
            </div>
            {groupedData.map(({ group, rowHeight }, index) => (
              <div key={group} style={{ height: `${rowHeight}px`, borderBottom: '1px solid #ddd', padding: '0 10px', display: 'flex', alignItems: 'center', backgroundColor: index % 2 === 0 ? '#e8e8e8' : '#f0f0f0', color: group === 'Sans technicien' ? 'red' : 'inherit' }}>
                {group || 'N/A'}
              </div>
            ))}
          </div>

          {/* Zone de contenu */}
          <div style={{ flex: 1, position: 'relative' }}>
            {renderTimeHeader(HEADER_HEIGHT)}
            {groupedData.map(({ group, tasks, overlaps, rowHeight }, index) => (
              <div 
                key={group}
                style={{ 
                  height: `${rowHeight}px`,
                  borderBottom: '1px solid #ddd',
                  position: 'relative',
                  backgroundColor: dropZoneActive === group ? 'rgba(59, 130, 246, 0.1)' : (index % 2 === 0 ? '#fff' : '#f8f8f8')
                }}
                onDragOver={groupBy === 'Technicien' ? handleDragOver : undefined}
                onDragEnter={groupBy === 'Technicien' ? (e) => handleDragEnter(e, group) : undefined}
                onDragLeave={groupBy === 'Technicien' ? (e) => handleDragLeave(e, group) : undefined}
                onDrop={groupBy === 'Technicien' ? (e) => handleDrop(group, e) : undefined}
              >
                {tasks.map(taskData => {
                  const verticalPosition = overlaps.get(taskData.operationId) || 0;
                  return (
                    <div
                      key={`${taskData.operationId}_${selectedDate}`}
                      draggable={groupBy === 'Technicien'}
                      onDragStart={(e) => handleDragStart(e, taskData)}
                      onDragEnd={handleDragEnd}
                      style={{
                        position: 'absolute',
                        left: `${taskData.startPercentage}%`,
                        width: `${taskData.duration}%`,
                        height: `${TASK_HEIGHT}px`,
                        top: TASK_MARGIN + (verticalPosition * (TASK_HEIGHT + TASK_MARGIN)),
                        backgroundColor: getUniqueColor(tasks.indexOf(taskData)),
                        borderRadius: '3px',
                        padding: '0 5px',
                        fontSize: '12px',
                        color: 'white',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        userSelect: 'none',
                        cursor: groupBy === 'Technicien' ? 'grab' : 'default',
                        borderLeft: !taskData.isStart ? '4px solid rgba(0,0,0,0.3)' : undefined,
                        borderRight: !taskData.isEnd ? '4px solid rgba(0,0,0,0.3)' : undefined
                      }}
                    >
                      {renderGanttTaskContent(taskData.task, groupBy, labelIndex)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  const tabContent = [
    { title: 'Tableau', content: renderTable(filteredData) },
    {
      title: 'Vue Véhicule',
      content: (
        <div className="space-y-8">
          <select 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full md:w-auto p-2 border rounded"
          >
            <option value="">Sélectionnez une date</option>
            {uniqueDates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>

          <div className="space-y-6">
            {/* Section Gantt */}
            <div className="relative bg-white rounded-lg shadow-sm">
              {renderGanttChart('Véhicule')}
            </div>

            {/* Section Tableau */}
            {selectedDate && (
              <div className="mt-8 border-t-2 border-gray-200 pt-8">
                <h3 className="text-lg font-semibold mb-4">Détails des opérations pour le {selectedDate}</h3>
                {renderTable(filterDataForDate(selectedDate))}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Vue Lieu',
      content: (
        <div className="space-y-8">
          <select 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full md:w-auto p-2 border rounded"
          >
            <option value="">Sélectionnez une date</option>
            {uniqueDates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>

          <div className="space-y-6">
            {/* Section Gantt */}
            <div className="relative bg-white rounded-lg shadow-sm">
              {renderGanttChart('Lieu')}
            </div>

            {/* Section Tableau */}
            {selectedDate && (
              <div className="mt-8 border-t-2 border-gray-200 pt-8">
                <h3 className="text-lg font-semibold mb-4">Détails des opérations pour le {selectedDate}</h3>
                {renderTable(filterDataForDate(selectedDate))}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Vue Technicien',
      content: (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <select 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto p-2 border rounded"
            >
              <option value="">Sélectionnez une date</option>
              {uniqueDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newTechnician}
                onChange={(e) => setNewTechnician(e.target.value)}
                placeholder="Nouveau technicien"
                className="flex-1 min-w-[200px] p-2 border rounded"
              />
              <button
                onClick={handleAddTechnician}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 
                         transition-colors duration-200 whitespace-nowrap"
                disabled={newTechnician.trim().toLowerCase() === 'sans technicien'}
                title={newTechnician.trim().toLowerCase() === 'sans technicien' ? 
                       "Impossible d'ajouter 'Sans technicien'" : ''}
              >
                Ajouter Technicien
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Section Gantt */}
            <div className="relative bg-white rounded-lg shadow-sm">
              {renderGanttChart('Technicien')}
            </div>

            {draggedTask && (
              <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-lg">
                {draggedTask.task[2] !== selectedDate ? (
                  <span className="text-red-600">
                    Impossible de déplacer une tâche d'un autre jour ({draggedTask.task[2]})
                  </span>
                ) : (
                  "Glissez la tâche sur une ligne pour réaffecter au technicien correspondant"
                )}
              </div>
            )}

            <div className="text-sm text-gray-500 italic">
              Note : Les tâches sans technicien sont affichées en rouge au bas du planning.
              Les tâches sur plusieurs jours sont indiquées par des bordures spéciales.
            </div>

            {/* Section Tableau */}
            {selectedDate && (
              <div className="mt-8 border-t-2 border-gray-200 pt-8">
                <h3 className="text-lg font-semibold mb-4">Détails des opérations pour le {selectedDate}</h3>
                {renderTable(filterDataForDate(selectedDate))}
              </div>
            )}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="container mx-auto p-4 min-h-screen bg-gray-50">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm">
          <input 
            type="file" 
            onChange={handleFileUpload} 
            accept=".csv" 
            className="flex-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {tabContent.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`
                px-4 py-2 rounded-lg transition-all duration-200
                ${activeTab === index 
                  ? 'bg-blue-500 text-white shadow-md scale-105' 
                  : 'bg-white hover:bg-gray-100'
                }
              `}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {tabContent[activeTab].content}
      </div>
    </div>
  );
  };

  export default CSVViewer;
