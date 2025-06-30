import React from 'react';
import { TodoItem } from '@/types/data';
import { themes } from '@/constants/themes';
import { Flag, ListTodo } from 'lucide-react';

interface TasksPanelProps {
  tasks: TodoItem[];
  currentTheme: typeof themes.dark;
}

const TasksPanel: React.FC<TasksPanelProps> = ({ tasks, currentTheme }) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <ListTodo className={`${currentTheme.text.muted} w-12 h-12 mb-3 mx-auto`} />
          <p className={`${currentTheme.text.secondary} text-sm`}>タスクはありません</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: TodoItem['status']) => {
    const colors = currentTheme.text.primary === 'text-white' ? {
      'todo': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'doing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'done': 'bg-green-500/20 text-green-400 border-green-500/30'
    } : {
      'todo': 'bg-amber-100 text-amber-700 border-amber-300',
      'doing': 'bg-blue-100 text-blue-700 border-blue-300',
      'done': 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[status] || (currentTheme.text.primary === 'text-white' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-300');
  };

  const getPriorityIcon = (priority: TodoItem['priority']) => {
    const colors = {
      'high': 'text-red-500',
      'medium': 'text-yellow-500',
      'low': 'text-green-500'
    };
    return <Flag className={`${priority ? colors[priority] || 'text-gray-400' : 'text-gray-400'} w-3 h-3`} />;
  };

  const getStatusLabel = (status: TodoItem['status']) => {
    const labels = {
      'todo': '未着手',
      'doing': '進行中',
      'done': '完了'
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className={`${currentTheme.cardInner} rounded-lg p-4 transition-all duration-200 hover:shadow-md border ${currentTheme === themes.dark ? 'border-gray-700/50 hover:bg-gray-800/50' : currentTheme === themes.modern ? 'border-white/30 hover:bg-white/15' : 'border-gray-200 hover:bg-gray-50'}`}>
          <div className="flex items-start justify-between gap-3">
            <h3 className={`${currentTheme.text.primary} font-medium text-sm flex-1 leading-relaxed`}>{task.title}</h3>
            <div className="flex-shrink-0">{getPriorityIcon(task.priority)}</div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TasksPanel;
